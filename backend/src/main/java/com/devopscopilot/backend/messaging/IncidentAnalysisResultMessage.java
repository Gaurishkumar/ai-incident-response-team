package com.devopscopilot.backend.messaging;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class IncidentAnalysisResultMessage {

    @JsonProperty("message_id")
    private String messageId;

    @JsonProperty("incident_id")
    private String incidentId;

    @JsonProperty("analysis_status")
    private String analysisStatus;

    @JsonProperty("agent_runs")
    private List<AgentRunResult> agentRuns;

    @JsonProperty("root_cause")
    private RootCauseResult rootCause;

    @JsonProperty("recommendations")
    private List<RecommendationResult> recommendations;

    @JsonProperty("completed_at")
    private String completedAt;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class AgentRunResult {
        @JsonProperty("agent_name")    private String agentName;
        @JsonProperty("status")        private String status;
        @JsonProperty("started_at")    private String startedAt;
        @JsonProperty("finished_at")   private String finishedAt;
        @JsonProperty("retry_count")   private int retryCount;
        @JsonProperty("output_summary") private String outputSummary;
        @JsonProperty("error_message") private String errorMessage;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class RootCauseResult {
        @JsonProperty("primary_cause")        private String primaryCause;
        @JsonProperty("causal_chain")         private List<String> causalChain;
        @JsonProperty("confidence_score")     private int confidenceScore;
        @JsonProperty("root_cause_category")  private String rootCauseCategory;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class RecommendationResult {
        @JsonProperty("recommendation_order") private int recommendationOrder;
        @JsonProperty("action")               private String action;
        @JsonProperty("rationale")            private String rationale;
        @JsonProperty("priority")             private String priority;
        @JsonProperty("responsible_team")     private String responsibleTeam;
    }
}
