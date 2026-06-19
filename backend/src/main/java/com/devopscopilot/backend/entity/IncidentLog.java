package com.devopscopilot.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "incident_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IncidentLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false, unique = true)
    private Incident incident;

    @Column(name = "raw_log_content", nullable = false, columnDefinition = "TEXT")
    private String rawLogContent;

    @CreationTimestamp
    @Column(name = "submitted_at", nullable = false, updatable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime submittedAt;
}
