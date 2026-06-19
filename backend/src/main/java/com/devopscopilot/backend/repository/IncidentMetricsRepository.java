package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.IncidentMetrics;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface IncidentMetricsRepository extends JpaRepository<IncidentMetrics, UUID> {
    Optional<IncidentMetrics> findByIncidentId(UUID incidentId);
}
