package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class DashboardStatsResponse {
    private long totalIncidents;
    private long activeIncidents;
    private long resolvedToday;
    private long failedToday;
    private double avgResolutionMinutes;
    private long p1Count;
    private long p2Count;
}
