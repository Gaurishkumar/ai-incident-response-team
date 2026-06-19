package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data @Builder
public class MetricsResponse {
    private BigDecimal cpuUsagePercent;
    private BigDecimal memoryUsagePercent;
    private BigDecimal errorRatePercent;
    private Integer responseTimeMs;
}
