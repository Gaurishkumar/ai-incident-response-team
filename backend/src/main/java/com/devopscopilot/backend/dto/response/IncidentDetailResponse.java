package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data @Builder
public class IncidentDetailResponse {
    private UUID id;
    private String title;
    private String description;
    private String environment;
    private String severity;
    private String status;
    private List<String> affectedServices;
    private MetricsResponse metrics;
    private String rawLogs;
    private List<AgentRunResponse> agentRuns;
    private AnalysisResponse analysis;
    private List<RecommendationResponse> recommendations;
    private OffsetDateTime createdAt;
    private OffsetDateTime resolvedAt;
}
