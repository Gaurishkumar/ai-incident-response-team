package com.devopscopilot.backend.controller;

import com.devopscopilot.backend.dto.request.RejectRequest;
import com.devopscopilot.backend.dto.response.ApiResponse;
import com.devopscopilot.backend.dto.response.OrganizationRequestResponse;
import com.devopscopilot.backend.dto.response.OrganizationResponse;
import com.devopscopilot.backend.service.OrganizationAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final OrganizationAdminService organizationAdminService;

    @GetMapping("/organization-requests")
    public ResponseEntity<ApiResponse<List<OrganizationRequestResponse>>> listPendingRequests(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.ok(organizationAdminService.listPendingRequests(userId)));
    }

    @GetMapping("/organizations")
    public ResponseEntity<ApiResponse<List<OrganizationResponse>>> listApprovedOrganizations(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.ok(organizationAdminService.listApprovedOrganizations(userId)));
    }

    @PostMapping("/organization-requests/{requestId}/approve")
    public ResponseEntity<ApiResponse<OrganizationResponse>> approveRequest(
            @AuthenticationPrincipal String userId,
            @PathVariable UUID requestId) {
        OrganizationResponse response = organizationAdminService.approveRequest(userId, requestId);
        return ResponseEntity.status(HttpStatus.OK).body(ApiResponse.ok(response));
    }

    @PostMapping("/organization-requests/{requestId}/reject")
    public ResponseEntity<ApiResponse<OrganizationRequestResponse>> rejectRequest(
            @AuthenticationPrincipal String userId,
            @PathVariable UUID requestId,
            @Valid @RequestBody RejectRequest rejectRequest) {
        OrganizationRequestResponse response = organizationAdminService.rejectRequest(userId, requestId, rejectRequest);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
