package com.devopscopilot.backend.controller;

import com.devopscopilot.backend.dto.response.ApiResponse;
import com.devopscopilot.backend.dto.response.DashboardStatsResponse;
import com.devopscopilot.backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<DashboardStatsResponse>> getStats(
            @AuthenticationPrincipal String userId) {
        DashboardStatsResponse stats = dashboardService.getStats(userId);
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }
}
