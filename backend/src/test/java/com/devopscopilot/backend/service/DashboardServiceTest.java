package com.devopscopilot.backend.service;

import com.devopscopilot.backend.dto.response.DashboardStatsResponse;
import com.devopscopilot.backend.entity.Organization;
import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.IncidentRepository;
import com.devopscopilot.backend.repository.OrganizationRepository;
import com.devopscopilot.backend.repository.SystemAdminRepository;
import com.devopscopilot.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock private IncidentRepository incidentRepository;
    @Mock private UserRepository userRepository;
    @Mock private SystemAdminRepository systemAdminRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private RedisTemplate<String, Object> redisTemplate;

    private DashboardService dashboardService;

    @BeforeEach
    void setUp() {
        dashboardService = new DashboardService(
            incidentRepository,
            userRepository,
            systemAdminRepository,
            organizationRepository,
            redisTemplate
        );
    }

    @Test
    void memberStatsUseCreatorScopedQueries() {
        UUID userId = UUID.fromString("55555555-5555-5555-5555-555555555555");
        UUID orgId = UUID.fromString("66666666-6666-6666-6666-666666666666");
        User user = activeUser(userId, orgId, "MEMBER");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(systemAdminRepository.existsByUserId(userId)).thenReturn(false);
        when(organizationRepository.findById(orgId)).thenReturn(Optional.of(approvedOrg(orgId)));
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("dashboard:stats:" + userId)).thenReturn(null);
        when(incidentRepository.countByCreatedById(userId)).thenReturn(3L);
        when(incidentRepository.countActiveByCreatedById(userId)).thenReturn(1L);
        when(incidentRepository.countResolvedSinceByCreatedById(eq(userId), any(OffsetDateTime.class))).thenReturn(2L);
        when(incidentRepository.countFailedSinceByCreatedById(eq(userId), any(OffsetDateTime.class))).thenReturn(0L);
        when(incidentRepository.avgResolutionMinutesByCreatedById(userId)).thenReturn(12.5);
        when(incidentRepository.countByCreatedByIdAndSeverity(userId, "P1")).thenReturn(1L);
        when(incidentRepository.countByCreatedByIdAndSeverity(userId, "P2")).thenReturn(2L);

        DashboardStatsResponse stats = dashboardService.getStats(userId.toString());

        assertThat(stats.getTotalIncidents()).isEqualTo(3L);
        assertThat(stats.getActiveIncidents()).isEqualTo(1L);
        assertThat(stats.getAvgResolutionMinutes()).isEqualTo(12.5);
        verify(incidentRepository).countByCreatedById(userId);
        verify(incidentRepository).countActiveByCreatedById(userId);
        verify(incidentRepository, never()).countByOrganizationId(any());
        verify(incidentRepository, never()).count();
    }

    @Test
    void superAdminStatsRemainGlobal() {
        UUID userId = UUID.fromString("77777777-7777-7777-7777-777777777777");
        User user = User.builder()
            .id(userId)
            .username("root")
            .email("root@example.com")
            .passwordHash("hash")
            .role("ADMIN")
            .accountStatus("ACTIVE")
            .isActive(true)
            .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(systemAdminRepository.existsByUserId(userId)).thenReturn(true);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("dashboard:stats:" + userId)).thenReturn(null);
        when(incidentRepository.count()).thenReturn(9L);
        when(incidentRepository.countActive()).thenReturn(4L);
        when(incidentRepository.countResolvedSince(any())).thenReturn(2L);
        when(incidentRepository.countFailedSince(any())).thenReturn(1L);
        when(incidentRepository.avgResolutionMinutes()).thenReturn(33.0);
        when(incidentRepository.countByStatus("P1")).thenReturn(2L);
        when(incidentRepository.countByStatus("P2")).thenReturn(3L);

        DashboardStatsResponse stats = dashboardService.getStats(userId.toString());

        assertThat(stats.getTotalIncidents()).isEqualTo(9L);
        assertThat(stats.getActiveIncidents()).isEqualTo(4L);
        verify(incidentRepository).count();
        verify(incidentRepository, never()).countByCreatedById(any());
    }

    private User activeUser(UUID userId, UUID orgId, String role) {
        return User.builder()
            .id(userId)
            .username("user")
            .email("user@example.com")
            .passwordHash("hash")
            .role(role)
            .organizationId(orgId)
            .accountStatus("ACTIVE")
            .isActive(true)
            .build();
    }

    private Organization approvedOrg(UUID orgId) {
        return Organization.builder()
            .id(orgId)
            .name("Org")
            .domainKey("org.com")
            .status("APPROVED")
            .build();
    }
}
