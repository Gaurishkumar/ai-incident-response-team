package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data @Builder
public class AgentRunResponse {
    private String agentName;
    private String status;
    private OffsetDateTime startedAt;
    private OffsetDateTime finishedAt;
    private String outputSummary;
}
