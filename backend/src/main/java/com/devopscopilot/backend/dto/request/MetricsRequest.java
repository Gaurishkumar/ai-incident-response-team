package com.devopscopilot.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class MetricsRequest {

    @NotNull
    @DecimalMin("0.0") @DecimalMax("100.0")
    @JsonProperty("cpu_usage_percent")
    private BigDecimal cpuUsagePercent;

    @NotNull
    @DecimalMin("0.0") @DecimalMax("100.0")
    @JsonProperty("memory_usage_percent")
    private BigDecimal memoryUsagePercent;

    @NotNull
    @DecimalMin("0.0") @DecimalMax("100.0")
    @JsonProperty("error_rate_percent")
    private BigDecimal errorRatePercent;

    @NotNull @Min(1) @Max(60000)
    @JsonProperty("response_time_ms")
    private Integer responseTimeMs;
}
