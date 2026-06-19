package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data @Builder
public class IncidentSummaryResponse {
    private UUID id;
    private String title;
    private String severity;
    private String status;
    private String environment;
    private List<String> affectedServices;
    private OffsetDateTime createdAt;
    private OffsetDateTime resolvedAt;
}
