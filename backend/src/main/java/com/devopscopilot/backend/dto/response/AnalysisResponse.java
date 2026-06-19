package com.devopscopilot.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class AnalysisResponse {
    private String primaryCause;
    private List<String> causalChain;
    private Integer confidenceScore;
    private String rootCauseCategory;
}
