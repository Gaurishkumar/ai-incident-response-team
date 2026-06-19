package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.AgentRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AgentRunRepository extends JpaRepository<AgentRun, UUID> {
    List<AgentRun> findByIncidentIdOrderByStartedAtAsc(UUID incidentId);
}
