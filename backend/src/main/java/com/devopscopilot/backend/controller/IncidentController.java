package com.devopscopilot.backend.controller;

import com.devopscopilot.backend.dto.request.IncidentCreateRequest;
import com.devopscopilot.backend.dto.response.*;
import com.devopscopilot.backend.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    @PostMapping
    public ResponseEntity<ApiResponse<IncidentSummaryResponse>> createIncident(
            @Valid @RequestBody IncidentCreateRequest req,
            @AuthenticationPrincipal String userId) {
        IncidentSummaryResponse summary = incidentService.createIncident(req, UUID.fromString(userId));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(summary));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<IncidentSummaryResponse>>> listIncidents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<IncidentSummaryResponse> incidents =
            incidentService.listIncidents(status, severity, page, size);
        return ResponseEntity.ok(ApiResponse.ok(incidents));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<IncidentDetailResponse>> getIncident(
            @PathVariable UUID id) {
        IncidentDetailResponse detail = incidentService.getIncidentDetail(id);
        return ResponseEntity.ok(ApiResponse.ok(detail));
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<ApiResponse<IncidentStatusResponse>> getIncidentStatus(
            @PathVariable UUID id) {
        IncidentStatusResponse status = incidentService.getIncidentStatus(id);
        return ResponseEntity.ok(ApiResponse.ok(status));
    }
}
