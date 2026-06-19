package com.devopscopilot.backend.service;

import com.devopscopilot.backend.entity.*;
import com.devopscopilot.backend.messaging.IncidentAnalysisResultMessage;
import com.devopscopilot.backend.messaging.IncidentAnalysisResultMessage.AgentRunResult;
import com.devopscopilot.backend.messaging.IncidentAnalysisResultMessage.RootCauseResult;
import com.devopscopilot.backend.messaging.IncidentAnalysisResultMessage.RecommendationResult;
import com.devopscopilot.backend.repository.*;
import com.rabbitmq.client.Channel;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class AnalysisResultHandler {

    private final IncidentRepository incidentRepository;
    private final AgentRunRepository agentRunRepository;
    private final IncidentAnalysisRepository analysisRepository;
    private final RecommendationRepository recommendationRepository;
    private final IncidentService incidentService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Counter incidentsResolvedCounter;

    public AnalysisResultHandler(
            IncidentRepository incidentRepository,
            AgentRunRepository agentRunRepository,
            IncidentAnalysisRepository analysisRepository,
            RecommendationRepository recommendationRepository,
            IncidentService incidentService,
            SimpMessagingTemplate messagingTemplate,
            MeterRegistry meterRegistry) {
        this.incidentRepository = incidentRepository;
        this.agentRunRepository = agentRunRepository;
        this.analysisRepository = analysisRepository;
        this.recommendationRepository = recommendationRepository;
        this.incidentService = incidentService;
        this.messagingTemplate = messagingTemplate;
        this.incidentsResolvedCounter = Counter.builder("incidents_resolved_total")
            .description("Total incidents resolved")
            .register(meterRegistry);
    }

    @RabbitListener(queues = "incident.results.queue",
                    containerFactory = "rabbitListenerContainerFactory")
    public void handleAnalysisResult(
            IncidentAnalysisResultMessage result,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {

        UUID incidentId = UUID.fromString(result.getIncidentId());
        log.info("[{}] Received analysis result, status={}", incidentId, result.getAnalysisStatus());

        try {
            persistResult(result, incidentId);
            channel.basicAck(deliveryTag, false);

            // Evict stale cache entry
            incidentService.evictIncidentCache(incidentId);

            // Push WebSocket notification to frontend
            messagingTemplate.convertAndSend(
                "/topic/incidents/" + incidentId,
                Map.of(
                    "type", "INCIDENT_RESOLVED",
                    "incidentId", incidentId.toString(),
                    "analysisStatus", result.getAnalysisStatus(),
                    "timestamp", OffsetDateTime.now().toString()
                )
            );

            incidentsResolvedCounter.increment();
            log.info("[{}] Analysis result persisted and frontend notified", incidentId);

        } catch (Exception e) {
            log.error("[{}] Failed to persist result: {}", incidentId, e.getMessage(), e);
            try {
                channel.basicNack(deliveryTag, false, true);
            } catch (Exception nackEx) {
                log.error("Failed to nack message", nackEx);
            }
        }
    }

    @Transactional
    protected void persistResult(IncidentAnalysisResultMessage result, UUID incidentId) {
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IllegalStateException("Incident not found: " + incidentId));

        // Determine final status
        String finalStatus = "FAILED".equals(result.getAnalysisStatus()) ? "FAILED" : "RESOLVED";
        incident.setStatus(finalStatus);
        incident.setResolvedAt(OffsetDateTime.now());
        incidentRepository.save(incident);

        // Insert agent_runs (3 rows)
        if (result.getAgentRuns() != null) {
            for (AgentRunResult ar : result.getAgentRuns()) {
                agentRunRepository.save(AgentRun.builder()
                    .incident(incident)
                    .agentName(ar.getAgentName())
                    .status(ar.getStatus())
                    .startedAt(parseDateTime(ar.getStartedAt()))
                    .finishedAt(parseDateTime(ar.getFinishedAt()))
                    .retryCount(ar.getRetryCount())
                    .outputSummary(ar.getOutputSummary())
                    .errorMessage(ar.getErrorMessage())
                    .build());
            }
        }

        // Insert incident_analysis (1 row)
        RootCauseResult rc = result.getRootCause();
        IncidentAnalysis analysis = IncidentAnalysis.builder()
            .incident(incident)
            .primaryCause(rc != null ? rc.getPrimaryCause() : null)
            .causalChain(rc != null ? rc.getCausalChain() : null)
            .confidenceScore(rc != null ? rc.getConfidenceScore() : null)
            .rootCauseCategory(rc != null ? rc.getRootCauseCategory() : null)
            .build();
        analysisRepository.save(analysis);

        // Insert recommendations
        if (result.getRecommendations() != null) {
            for (RecommendationResult rec : result.getRecommendations()) {
                recommendationRepository.save(Recommendation.builder()
                    .incident(incident)
                    .recommendationOrder(rec.getRecommendationOrder())
                    .action(rec.getAction())
                    .rationale(rec.getRationale())
                    .priority(rec.getPriority())
                    .responsibleTeam(rec.getResponsibleTeam())
                    .build());
            }
        }
    }

    private OffsetDateTime parseDateTime(String iso) {
        if (iso == null) return null;
        try {
            return OffsetDateTime.parse(iso);
        } catch (Exception e) {
            return OffsetDateTime.now();
        }
    }
}
