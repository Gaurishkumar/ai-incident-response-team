package com.devopscopilot.backend.service;

import com.devopscopilot.backend.dto.response.DashboardStatsResponse;
import com.devopscopilot.backend.entity.Organization;
import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.OrganizationRepository;
import com.devopscopilot.backend.repository.IncidentRepository;
import com.devopscopilot.backend.repository.SystemAdminRepository;
import com.devopscopilot.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardService {

    private final IncidentRepository incidentRepository;
    private final UserRepository userRepository;
    private final SystemAdminRepository systemAdminRepository;
    private final OrganizationRepository organizationRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String STATS_CACHE_PREFIX = "dashboard:stats:";
    private static final long STATS_CACHE_TTL_SECONDS = 120L;

    @SuppressWarnings("unchecked")
    public DashboardStatsResponse getStats(String userId) {
        User user = resolveActiveUser(userId);
        String cacheKey = STATS_CACHE_PREFIX + userId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof DashboardStatsResponse stats) {
            return stats;
        }

        OffsetDateTime startOfDay = OffsetDateTime.now(ZoneOffset.UTC).toLocalDate()
            .atStartOfDay().atOffset(ZoneOffset.UTC);

        DashboardStatsResponse stats = isSuperAdmin(user.getId())
            ? DashboardStatsResponse.builder()
                .totalIncidents(incidentRepository.count())
                .activeIncidents(incidentRepository.countActive())
                .resolvedToday(incidentRepository.countResolvedSince(startOfDay))
                .failedToday(incidentRepository.countFailedSince(startOfDay))
                .avgResolutionMinutes(firstNonNull(incidentRepository.avgResolutionMinutes(), 0.0))
                .p1Count(incidentRepository.countByStatus("P1"))
                .p2Count(incidentRepository.countByStatus("P2"))
                .build()
            : isOrgAdmin(user)
                ? DashboardStatsResponse.builder()
                    .totalIncidents(incidentRepository.countByOrganizationId(user.getOrganizationId()))
                    .activeIncidents(incidentRepository.countActiveByOrganizationId(user.getOrganizationId()))
                    .resolvedToday(incidentRepository.countResolvedSinceByOrganizationId(user.getOrganizationId(), startOfDay))
                    .failedToday(incidentRepository.countFailedSinceByOrganizationId(user.getOrganizationId(), startOfDay))
                    .avgResolutionMinutes(firstNonNull(
                        incidentRepository.avgResolutionMinutesByOrganizationId(user.getOrganizationId()), 0.0))
                    .p1Count(incidentRepository.countByOrganizationIdAndSeverity(user.getOrganizationId(), "P1"))
                    .p2Count(incidentRepository.countByOrganizationIdAndSeverity(user.getOrganizationId(), "P2"))
                    .build()
            : DashboardStatsResponse.builder()
                .totalIncidents(incidentRepository.countByCreatedById(user.getId()))
                .activeIncidents(incidentRepository.countActiveByCreatedById(user.getId()))
                .resolvedToday(incidentRepository.countResolvedSinceByCreatedById(user.getId(), startOfDay))
                .failedToday(incidentRepository.countFailedSinceByCreatedById(user.getId(), startOfDay))
                .avgResolutionMinutes(firstNonNull(
                    incidentRepository.avgResolutionMinutesByCreatedById(user.getId()), 0.0))
                .p1Count(incidentRepository.countByCreatedByIdAndSeverity(user.getId(), "P1"))
                .p2Count(incidentRepository.countByCreatedByIdAndSeverity(user.getId(), "P2"))
                .build();

        redisTemplate.opsForValue().set(cacheKey, stats, STATS_CACHE_TTL_SECONDS, TimeUnit.SECONDS);
        return stats;
    }

    private double firstNonNull(Double value, double fallback) {
        return value != null ? value : fallback;
    }

    private User resolveActiveUser(String userId) {
        User user = userRepository.findById(java.util.UUID.fromString(userId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!Boolean.TRUE.equals(user.getIsActive()) || !"ACTIVE".equals(user.getAccountStatus())) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Account not yet approved");
        }

        if (!isSuperAdmin(user.getId())) {
            UUID organizationId = user.getOrganizationId();
            if (organizationId == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization access required");
            }

            Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization not found"));
            if (!"APPROVED".equals(org.getStatus())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization is not approved yet");
            }
        }
        return user;
    }

    private boolean isSuperAdmin(java.util.UUID userId) {
        return systemAdminRepository.existsByUserId(userId);
    }

    private boolean isOrgAdmin(User user) {
        return "ORG_ADMIN".equals(user.getRole());
    }
}
