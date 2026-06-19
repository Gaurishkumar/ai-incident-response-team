package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder
public class UserResponse {
    private UUID id;
    private String username;
    private String email;
    private String role;
    private OffsetDateTime createdAt;
}
