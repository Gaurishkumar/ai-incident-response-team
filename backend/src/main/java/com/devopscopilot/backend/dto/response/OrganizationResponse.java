package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class OrganizationResponse {
    private UUID id;
    private String domainKey;
    private String name;
    private UUID ownerUserId;
    private String status;
    private UUID approvedByUserId;
    private OffsetDateTime approvedAt;
    private OffsetDateTime createdAt;
}
