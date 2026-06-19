package com.devopscopilot.backend.service;

import com.devopscopilot.backend.dto.response.DashboardStatsResponse;
import com.devopscopilot.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardService {

    private final IncidentRepository incidentRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String STATS_CACHE_PREFIX = "dashboard:stats:";
    private static final long STATS_CACHE_TTL_SECONDS = 120L;

    @SuppressWarnings("unchecked")
    public DashboardStatsResponse getStats(String userId) {
        String cacheKey = STATS_CACHE_PREFIX + userId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof DashboardStatsResponse stats) {
            return stats;
        }

        OffsetDateTime startOfDay = OffsetDateTime.now(ZoneOffset.UTC).toLocalDate()
            .atStartOfDay().atOffset(ZoneOffset.UTC);

        DashboardStatsResponse stats = DashboardStatsResponse.builder()
            .totalIncidents(incidentRepository.count())
            .activeIncidents(incidentRepository.countActive())
            .resolvedToday(incidentRepository.countResolvedSince(startOfDay))
            .failedToday(incidentRepository.countFailedSince(startOfDay))
            .avgResolutionMinutes(
                firstNonNull(incidentRepository.avgResolutionMinutes(), 0.0))
            .p1Count(incidentRepository.countByStatus("P1"))
            .p2Count(incidentRepository.countByStatus("P2"))
            .build();

        redisTemplate.opsForValue().set(cacheKey, stats, STATS_CACHE_TTL_SECONDS, TimeUnit.SECONDS);
        return stats;
    }

    private double firstNonNull(Double value, double fallback) {
        return value != null ? value : fallback;
    }
}
