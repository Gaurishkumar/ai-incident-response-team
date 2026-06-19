package com.devopscopilot.backend.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "incident_analysis")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IncidentAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false, unique = true)
    private Incident incident;

    @Column(name = "primary_cause", columnDefinition = "TEXT")
    private String primaryCause;

    @Type(JsonType.class)
    @Column(name = "causal_chain", columnDefinition = "jsonb")
    private List<String> causalChain;

    @Column(name = "confidence_score")
    private Integer confidenceScore;

    @Column(name = "root_cause_category", length = 100)
    private String rootCauseCategory;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;
}
