package com.devopscopilot.backend.service;

import com.devopscopilot.backend.entity.Incident;
import com.devopscopilot.backend.entity.Organization;
import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.*;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IncidentServiceTest {

    @Mock private IncidentRepository incidentRepository;
    @Mock private IncidentMetricsRepository metricsRepository;
    @Mock private IncidentLogRepository logRepository;
    @Mock private AgentRunRepository agentRunRepository;
    @Mock private IncidentAnalysisRepository analysisRepository;
    @Mock private RecommendationRepository recommendationRepository;
    @Mock private UserRepository userRepository;
    @Mock private SystemAdminRepository systemAdminRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private RabbitTemplate rabbitTemplate;
    @Mock private RedisTemplate<String, Object> redisTemplate;

    private IncidentService incidentService;

    @BeforeEach
    void setUp() {
        incidentService = new IncidentService(
            incidentRepository,
            metricsRepository,
            logRepository,
            agentRunRepository,
            analysisRepository,
            recommendationRepository,
            userRepository,
            systemAdminRepository,
            organizationRepository,
            rabbitTemplate,
            redisTemplate,
            new SimpleMeterRegistry()
        );
    }

    @Test
    void listIncidentsForMemberUsesCreatorScope() {
        UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID orgId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        User member = activeUser(userId, orgId, "MEMBER");
        Incident incident = incident(userId, orgId, "Member incident");

        when(userRepository.findById(userId)).thenReturn(Optional.of(member));
        when(systemAdminRepository.existsByUserId(userId)).thenReturn(false);
        when(organizationRepository.findById(orgId)).thenReturn(Optional.of(approvedOrg(orgId)));
        when(incidentRepository.findAllByCreatedByIdOrderByCreatedAtDesc(userId, org.springframework.data.domain.PageRequest.of(0, 10)))
            .thenReturn(new PageImpl<>(List.of(incident)));

        Page<?> result = incidentService.listIncidents(userId.toString(), null, null, 0, 10);

        assertThat(result).hasSize(1);
        verify(incidentRepository).findAllByCreatedByIdOrderByCreatedAtDesc(userId, org.springframework.data.domain.PageRequest.of(0, 10));
        verify(incidentRepository, never()).findAllByOrganizationIdOrderByCreatedAtDesc(any(), any());
        verify(incidentRepository, never()).findAllByOrderByCreatedAtDesc(any());
    }

    @Test
    void listIncidentsForOrgAdminUsesOrgScope() {
        UUID userId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        UUID orgId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        User admin = activeUser(userId, orgId, "ORG_ADMIN");
        Incident incident = incident(userId, orgId, "Org incident");

        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
        when(systemAdminRepository.existsByUserId(userId)).thenReturn(false);
        when(organizationRepository.findById(orgId)).thenReturn(Optional.of(approvedOrg(orgId)));
        when(incidentRepository.findAllByOrganizationIdOrderByCreatedAtDesc(orgId, org.springframework.data.domain.PageRequest.of(0, 10)))
            .thenReturn(new PageImpl<>(List.of(incident)));

        Page<?> result = incidentService.listIncidents(userId.toString(), null, null, 0, 10);

        assertThat(result).hasSize(1);
        verify(incidentRepository).findAllByOrganizationIdOrderByCreatedAtDesc(orgId, org.springframework.data.domain.PageRequest.of(0, 10));
        verify(incidentRepository, never()).findAllByCreatedByIdOrderByCreatedAtDesc(any(), any());
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

    private Incident incident(UUID userId, UUID orgId, String title) {
        return Incident.builder()
            .id(UUID.randomUUID())
            .title(title)
            .description("desc")
            .environment("prod")
            .severity("P1")
            .status("PENDING")
            .affectedServices(List.of("api"))
            .createdBy(User.builder().id(userId).build())
            .organizationId(orgId)
            .createdAt(OffsetDateTime.now())
            .build();
    }
}
