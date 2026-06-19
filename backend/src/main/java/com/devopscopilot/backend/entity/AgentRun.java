package com.devopscopilot.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "agent_runs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false)
    private Incident incident;

    @Column(name = "agent_name", nullable = false, length = 100)
    private String agentName;

    @Column(nullable = false, length = 50)
    private String status;

    @Column(name = "started_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime startedAt;

    @Column(name = "finished_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime finishedAt;

    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private Integer retryCount = 0;

    @Column(name = "output_summary", columnDefinition = "TEXT")
    private String outputSummary;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
