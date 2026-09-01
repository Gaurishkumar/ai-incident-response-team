package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class OrganizationJoinRequestResponse {
    private UUID id;
    private UUID organizationId;
    private UUID userId;
    private String username;
    private String email;
    private String status;
    private String rejectionReason;
    private OffsetDateTime createdAt;
}
