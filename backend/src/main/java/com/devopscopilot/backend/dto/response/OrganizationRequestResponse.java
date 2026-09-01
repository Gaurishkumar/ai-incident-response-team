package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class OrganizationRequestResponse {
    private UUID id;
    private String domainKey;
    private String orgName;
    private UUID requestedByUserId;
    private String status;
    private String rejectionReason;
    private UUID approvedOrganizationId;
    private OffsetDateTime createdAt;
}
