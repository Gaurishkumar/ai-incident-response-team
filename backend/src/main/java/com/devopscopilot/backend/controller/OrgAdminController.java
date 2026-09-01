package com.devopscopilot.backend.controller;

import com.devopscopilot.backend.dto.request.RejectRequest;
import com.devopscopilot.backend.dto.response.ApiResponse;
import com.devopscopilot.backend.dto.response.OrganizationJoinRequestResponse;
import com.devopscopilot.backend.service.OrganizationAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/org-admin")
@RequiredArgsConstructor
public class OrgAdminController {

    private final OrganizationAdminService organizationAdminService;

    @GetMapping("/join-requests")
    public ResponseEntity<ApiResponse<List<OrganizationJoinRequestResponse>>> listPendingJoinRequests(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.ok(organizationAdminService.listPendingJoinRequests(userId)));
    }

    @PostMapping("/join-requests/{joinRequestId}/approve")
    public ResponseEntity<ApiResponse<OrganizationJoinRequestResponse>> approveJoinRequest(
            @AuthenticationPrincipal String userId,
            @PathVariable UUID joinRequestId) {
        return ResponseEntity.ok(ApiResponse.ok(
            organizationAdminService.approveJoinRequest(userId, joinRequestId)));
    }

    @PostMapping("/join-requests/{joinRequestId}/reject")
    public ResponseEntity<ApiResponse<OrganizationJoinRequestResponse>> rejectJoinRequest(
            @AuthenticationPrincipal String userId,
            @PathVariable UUID joinRequestId,
            @Valid @RequestBody RejectRequest rejectRequest) {
        return ResponseEntity.ok(ApiResponse.ok(
            organizationAdminService.rejectJoinRequest(userId, joinRequestId, rejectRequest)));
    }
}
