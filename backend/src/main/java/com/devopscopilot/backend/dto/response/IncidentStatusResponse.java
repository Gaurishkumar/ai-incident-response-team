package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class IncidentStatusResponse {
    private String status;
    private List<AgentRunResponse> agentRuns;
}
