package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class RecommendationResponse {
    private Integer recommendationOrder;
    private String action;
    private String rationale;
    private String priority;
    private String responsibleTeam;
}
