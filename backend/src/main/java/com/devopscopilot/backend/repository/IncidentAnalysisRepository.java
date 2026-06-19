package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.IncidentAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface IncidentAnalysisRepository extends JpaRepository<IncidentAnalysis, UUID> {
    Optional<IncidentAnalysis> findByIncidentId(UUID incidentId);
}
