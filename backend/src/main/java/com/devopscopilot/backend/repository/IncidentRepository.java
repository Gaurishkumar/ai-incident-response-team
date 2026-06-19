package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.Incident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface IncidentRepository extends JpaRepository<Incident, UUID> {

    Page<Incident> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Incident> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<Incident> findBySeverityOrderByCreatedAtDesc(String severity, Pageable pageable);

    Page<Incident> findByStatusAndSeverityOrderByCreatedAtDesc(
        String status, String severity, Pageable pageable);

    long countByStatus(String status);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.status IN ('ANALYZING', 'PENDING')")
    long countActive();

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.status = 'RESOLVED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countResolvedSince(OffsetDateTime startOfDay);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.status = 'FAILED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countFailedSince(OffsetDateTime startOfDay);

    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) " +
                   "FROM incidents WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL",
           nativeQuery = true)
    Double avgResolutionMinutes();

    // Incidents stuck in PENDING older than a threshold — for the retry scheduler
    @Query("SELECT i FROM Incident i WHERE i.status = 'PENDING' " +
           "AND i.createdAt < :threshold")
    List<Incident> findStuckPendingIncidents(OffsetDateTime threshold);
}
