package com.devopscopilot.backend.service;

import com.devopscopilot.backend.entity.Incident;
import com.devopscopilot.backend.entity.IncidentAnalysis;
import com.devopscopilot.backend.messaging.IncidentAnalysisResultMessage;
import com.devopscopilot.backend.repository.*;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalysisResultHandlerTest {

    @Mock private IncidentRepository incidentRepository;
    @Mock private AgentRunRepository agentRunRepository;
    @Mock private IncidentAnalysisRepository analysisRepository;
    @Mock private RecommendationRepository recommendationRepository;
    @Mock private IncidentService incidentService;
    @Mock private SimpMessagingTemplate messagingTemplate;

    private AnalysisResultHandler handler;

    @BeforeEach
    void setUp() {
        handler = new AnalysisResultHandler(
            incidentRepository,
            agentRunRepository,
            analysisRepository,
            recommendationRepository,
            incidentService,
            messagingTemplate,
            new SimpleMeterRegistry()
        );
    }

    @Test
    void persistResultSkipsDuplicateAnalysis() {
        UUID incidentId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        Incident incident = Incident.builder()
            .id(incidentId)
            .status("RESOLVED")
            .build();

        when(incidentRepository.findById(incidentId)).thenReturn(Optional.of(incident));
        when(analysisRepository.findByIncidentId(incidentId)).thenReturn(Optional.of(
            IncidentAnalysis.builder().incident(incident).build()
        ));

        handler.persistResult(new IncidentAnalysisResultMessage(), incidentId);

        verify(incidentRepository, never()).save(any());
        verify(agentRunRepository, never()).save(any());
        verify(recommendationRepository, never()).save(any());
        verify(analysisRepository, never()).save(any());
    }

    @Test
    void handleAnalysisResultAcksDuplicateKeyViolations() throws Exception {
        UUID incidentId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        AnalysisResultHandler spyHandler = spy(handler);
        IncidentAnalysisResultMessage message = new IncidentAnalysisResultMessage();
        message.setIncidentId(incidentId.toString());
        message.setAnalysisStatus("RESOLVED");

        doThrow(new DataIntegrityViolationException("duplicate key value violates unique constraint incident_analysis_incident_id_key"))
            .when(spyHandler).persistResult(message, incidentId);

        com.rabbitmq.client.Channel channel = mock(com.rabbitmq.client.Channel.class);

        spyHandler.handleAnalysisResult(message, channel, 42L);

        verify(channel).basicAck(42L, false);
        verify(channel, never()).basicNack(any(Long.class), any(Boolean.class), any(Boolean.class));
        verifyNoInteractions(messagingTemplate);
    }
}
