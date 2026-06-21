package com.devopscopilot.backend.messaging;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class IncidentAnalysisRequestMessage {

    @JsonProperty("message_id")
    private String messageId;

    @JsonProperty("incident_id")
    private String incidentId;

    @JsonProperty("organization_id")
    private String organizationId;

    @JsonProperty("published_at")
    private String publishedAt;
}
