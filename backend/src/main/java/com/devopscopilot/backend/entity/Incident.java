package com.devopscopilot.backend.entity;

import io.hypersistence.utils.hibernate.type.array.ListArrayType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "incidents")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 50)
    private String environment;

    @Column(nullable = false, length = 10)
    private String severity;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String status = "PENDING";

    @Type(ListArrayType.class)
    @Column(name = "affected_services", columnDefinition = "TEXT[]", nullable = false)
    private List<String> affectedServices;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "analysis_started_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime analysisStartedAt;

    @Column(name = "resolved_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime resolvedAt;
}
