package com.devopscopilot.backend.service;

import com.devopscopilot.backend.config.RabbitMQConfig;
import com.devopscopilot.backend.dto.request.IncidentCreateRequest;
import com.devopscopilot.backend.dto.response.*;
import com.devopscopilot.backend.entity.*;
import com.devopscopilot.backend.exception.IncidentNotFoundException;
import com.devopscopilot.backend.messaging.IncidentAnalysisRequestMessage;
import com.devopscopilot.backend.repository.*;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final IncidentMetricsRepository metricsRepository;
    private final IncidentLogRepository logRepository;
    private final AgentRunRepository agentRunRepository;
    private final IncidentAnalysisRepository analysisRepository;
    private final RecommendationRepository recommendationRepository;
    private final UserRepository userRepository;
    private final RabbitTemplate rabbitTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final Counter incidentsSubmittedCounter;
    private final Counter rabbitMqPublishFailuresCounter;

    private static final String RESULT_CACHE_PREFIX = "incident:result:";
    private static final long RESULT_CACHE_TTL_SECONDS = 600L;

    public IncidentService(
            IncidentRepository incidentRepository,
            IncidentMetricsRepository metricsRepository,
            IncidentLogRepository logRepository,
            AgentRunRepository agentRunRepository,
            IncidentAnalysisRepository analysisRepository,
            RecommendationRepository recommendationRepository,
            UserRepository userRepository,
            RabbitTemplate rabbitTemplate,
            RedisTemplate<String, Object> redisTemplate,
            MeterRegistry meterRegistry) {
        this.incidentRepository = incidentRepository;
        this.metricsRepository = metricsRepository;
        this.logRepository = logRepository;
        this.agentRunRepository = agentRunRepository;
        this.analysisRepository = analysisRepository;
        this.recommendationRepository = recommendationRepository;
        this.userRepository = userRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.redisTemplate = redisTemplate;
        this.incidentsSubmittedCounter = Counter.builder("incidents_submitted_total")
            .description("Total incidents submitted")
            .register(meterRegistry);
        this.rabbitMqPublishFailuresCounter = Counter.builder("rabbitmq_publish_failures_total")
            .description("RabbitMQ publish failures")
            .register(meterRegistry);
    }

    @Transactional
    public IncidentSummaryResponse createIncident(IncidentCreateRequest req, UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        // Three inserts in one atomic transaction
        Incident incident = incidentRepository.save(Incident.builder()
            .title(req.getIncidentTitle())
            .description(req.getDescription())
            .environment(req.getEnvironment())
            .severity(req.getSeverity())
            .affectedServices(req.getAffectedServices())
            .createdBy(user)
            .status("PENDING")
            .build());

        metricsRepository.save(IncidentMetrics.builder()
            .incident(incident)
            .cpuUsagePercent(req.getMetrics().getCpuUsagePercent())
            .memoryUsagePercent(req.getMetrics().getMemoryUsagePercent())
            .errorRatePercent(req.getMetrics().getErrorRatePercent())
            .responseTimeMs(req.getMetrics().getResponseTimeMs())
            .build());

        logRepository.save(IncidentLog.builder()
            .incident(incident)
            .rawLogContent(req.getRawLogs())
            .build());

        incidentsSubmittedCounter.increment();
        log.info("Incident {} created by user {}", incident.getId(), userId);

        // Register publish to fire only after the transaction commits and is visible to FastAPI
        UUID incidentId = incident.getId();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                publishAnalysisRequest(incidentId);
            }
        });

        return IncidentSummaryResponse.builder()
            .id(incident.getId())
            .title(incident.getTitle())
            .severity(incident.getSeverity())
            .status(incident.getStatus())
            .environment(incident.getEnvironment())
            .affectedServices(incident.getAffectedServices())
            .createdAt(incident.getCreatedAt())
            .build();
    }

    public void publishAnalysisRequest(UUID incidentId) {
        try {
            IncidentAnalysisRequestMessage msg = IncidentAnalysisRequestMessage.builder()
                .messageId(UUID.randomUUID().toString())
                .incidentId(incidentId.toString())
                .publishedAt(OffsetDateTime.now().toString())
                .build();

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.ANALYSIS_EXCHANGE,
                RabbitMQConfig.ANALYSIS_ROUTING_KEY,
                msg
            );
            log.debug("Published analysis request for incident {}", incidentId);
        } catch (Exception e) {
            rabbitMqPublishFailuresCounter.increment();
            log.error("Failed to publish analysis request for incident {}: {}", incidentId, e.getMessage());
            // Incident stays PENDING — retry scheduler will republish
        }
    }

    public Page<IncidentSummaryResponse> listIncidents(
            String status, String severity, int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        Page<Incident> incidents;

        if (status != null && severity != null) {
            incidents = incidentRepository.findByStatusAndSeverityOrderByCreatedAtDesc(
                status, severity, pageable);
        } else if (status != null) {
            incidents = incidentRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        } else if (severity != null) {
            incidents = incidentRepository.findBySeverityOrderByCreatedAtDesc(severity, pageable);
        } else {
            incidents = incidentRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return incidents.map(this::toSummary);
    }

    @SuppressWarnings("unchecked")
    public IncidentDetailResponse getIncidentDetail(UUID incidentId) {
        String cacheKey = RESULT_CACHE_PREFIX + incidentId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof Map<?, ?> map) {
            // Re-serialise the cached map into IncidentDetailResponse via the cache
            // For simplicity, fall through and rebuild — cache stores the serialized form
        }

        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IncidentNotFoundException(incidentId));

        IncidentMetrics metrics = metricsRepository.findByIncidentId(incidentId).orElse(null);
        IncidentLog log         = logRepository.findByIncidentId(incidentId).orElse(null);
        List<AgentRun> agentRuns = agentRunRepository.findByIncidentIdOrderByStartedAtAsc(incidentId);
        IncidentAnalysis analysis = analysisRepository.findByIncidentId(incidentId).orElse(null);
        List<Recommendation> recs = recommendationRepository
            .findByIncidentIdOrderByRecommendationOrderAsc(incidentId);

        IncidentDetailResponse detail = IncidentDetailResponse.builder()
            .id(incident.getId())
            .title(incident.getTitle())
            .description(incident.getDescription())
            .environment(incident.getEnvironment())
            .severity(incident.getSeverity())
            .status(incident.getStatus())
            .affectedServices(incident.getAffectedServices())
            .metrics(metrics != null ? toMetricsResponse(metrics) : null)
            .rawLogs(log != null ? log.getRawLogContent() : null)
            .agentRuns(agentRuns.stream().map(this::toAgentRunResponse).toList())
            .analysis(analysis != null ? toAnalysisResponse(analysis) : null)
            .recommendations(recs.stream().map(this::toRecommendationResponse).toList())
            .createdAt(incident.getCreatedAt())
            .resolvedAt(incident.getResolvedAt())
            .build();

        // Cache if resolved/failed (stable state)
        if ("RESOLVED".equals(incident.getStatus()) || "FAILED".equals(incident.getStatus())) {
            redisTemplate.opsForValue().set(cacheKey, detail,
                RESULT_CACHE_TTL_SECONDS, TimeUnit.SECONDS);
        }

        return detail;
    }

    public IncidentStatusResponse getIncidentStatus(UUID incidentId) {
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IncidentNotFoundException(incidentId));

        List<AgentRun> runs = agentRunRepository.findByIncidentIdOrderByStartedAtAsc(incidentId);
        return IncidentStatusResponse.builder()
            .status(incident.getStatus())
            .agentRuns(runs.stream().map(this::toAgentRunResponse).toList())
            .build();
    }

    public void evictIncidentCache(UUID incidentId) {
        redisTemplate.delete(RESULT_CACHE_PREFIX + incidentId);
    }

    // ---- Mappers ----

    private IncidentSummaryResponse toSummary(Incident i) {
        return IncidentSummaryResponse.builder()
            .id(i.getId()).title(i.getTitle()).severity(i.getSeverity())
            .status(i.getStatus()).environment(i.getEnvironment())
            .affectedServices(i.getAffectedServices())
            .createdAt(i.getCreatedAt()).resolvedAt(i.getResolvedAt())
            .build();
    }

    private MetricsResponse toMetricsResponse(IncidentMetrics m) {
        return MetricsResponse.builder()
            .cpuUsagePercent(m.getCpuUsagePercent())
            .memoryUsagePercent(m.getMemoryUsagePercent())
            .errorRatePercent(m.getErrorRatePercent())
            .responseTimeMs(m.getResponseTimeMs())
            .build();
    }

    private AgentRunResponse toAgentRunResponse(AgentRun r) {
        return AgentRunResponse.builder()
            .agentName(r.getAgentName()).status(r.getStatus())
            .startedAt(r.getStartedAt()).finishedAt(r.getFinishedAt())
            .outputSummary(r.getOutputSummary())
            .build();
    }

    private AnalysisResponse toAnalysisResponse(IncidentAnalysis a) {
        return AnalysisResponse.builder()
            .primaryCause(a.getPrimaryCause()).causalChain(a.getCausalChain())
            .confidenceScore(a.getConfidenceScore())
            .rootCauseCategory(a.getRootCauseCategory())
            .build();
    }

    private RecommendationResponse toRecommendationResponse(Recommendation r) {
        return RecommendationResponse.builder()
            .recommendationOrder(r.getRecommendationOrder()).action(r.getAction())
            .rationale(r.getRationale()).priority(r.getPriority())
            .responsibleTeam(r.getResponsibleTeam())
            .build();
    }
}
