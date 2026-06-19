package com.devopscopilot.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "recommendations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false)
    private Incident incident;

    @Column(name = "recommendation_order", nullable = false)
    private Integer recommendationOrder;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String action;

    @Column(columnDefinition = "TEXT")
    private String rationale;

    @Column(length = 50)
    private String priority;

    @Column(name = "responsible_team", length = 100)
    private String responsibleTeam;
}
