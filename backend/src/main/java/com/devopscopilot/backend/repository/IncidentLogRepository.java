package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.IncidentLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface IncidentLogRepository extends JpaRepository<IncidentLog, UUID> {
    Optional<IncidentLog> findByIncidentId(UUID incidentId);
}
