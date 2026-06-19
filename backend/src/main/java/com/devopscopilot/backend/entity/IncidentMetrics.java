package com.devopscopilot.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "incident_metrics")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IncidentMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false, unique = true)
    private Incident incident;

    @Column(name = "cpu_usage_percent", nullable = false,
            precision = 5, scale = 2)
    private BigDecimal cpuUsagePercent;

    @Column(name = "memory_usage_percent", nullable = false,
            precision = 5, scale = 2)
    private BigDecimal memoryUsagePercent;

    @Column(name = "error_rate_percent", nullable = false,
            precision = 5, scale = 2)
    private BigDecimal errorRatePercent;

    @Column(name = "response_time_ms", nullable = false)
    private Integer responseTimeMs;

    @CreationTimestamp
    @Column(name = "recorded_at", nullable = false, updatable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime recordedAt;
}
