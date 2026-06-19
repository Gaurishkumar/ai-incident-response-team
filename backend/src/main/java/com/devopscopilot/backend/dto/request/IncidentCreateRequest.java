package com.devopscopilot.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class IncidentCreateRequest {

    @NotBlank @Size(min = 10, max = 120)
    @JsonProperty("incident_title")
    private String incidentTitle;

    @NotBlank @Size(min = 50, max = 2000)
    private String description;

    @NotBlank @Pattern(regexp = "production|staging|development",
                       message = "Environment must be production, staging, or development")
    private String environment;

    @NotBlank @Pattern(regexp = "P[1-4]", message = "Severity must be P1, P2, P3, or P4")
    private String severity;

    @NotNull @Size(min = 1, max = 20)
    @JsonProperty("affected_services")
    private List<
        @NotBlank
        @Size(max = 50)
        @Pattern(regexp = "[a-zA-Z0-9\\-]+",
                 message = "Service name must contain only alphanumeric characters and hyphens")
        String
    > affectedServices;

    @NotBlank @Size(min = 50, max = 5000)
    @JsonProperty("raw_logs")
    private String rawLogs;

    @NotNull @Valid
    private MetricsRequest metrics;
}
