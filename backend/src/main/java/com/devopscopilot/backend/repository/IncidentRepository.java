package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.Incident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IncidentRepository extends JpaRepository<Incident, UUID> {

    Page<Incident> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Incident> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<Incident> findBySeverityOrderByCreatedAtDesc(String severity, Pageable pageable);

    Page<Incident> findByStatusAndSeverityOrderByCreatedAtDesc(
        String status, String severity, Pageable pageable);

    Page<Incident> findAllByOrganizationIdOrderByCreatedAtDesc(UUID organizationId, Pageable pageable);

    Page<Incident> findAllByCreatedByIdOrderByCreatedAtDesc(UUID createdById, Pageable pageable);

    Page<Incident> findByOrganizationIdAndStatusOrderByCreatedAtDesc(
        UUID organizationId, String status, Pageable pageable);

    Page<Incident> findByCreatedByIdAndStatusOrderByCreatedAtDesc(
        UUID createdById, String status, Pageable pageable);

    Page<Incident> findByOrganizationIdAndSeverityOrderByCreatedAtDesc(
        UUID organizationId, String severity, Pageable pageable);

    Page<Incident> findByCreatedByIdAndSeverityOrderByCreatedAtDesc(
        UUID createdById, String severity, Pageable pageable);

    Page<Incident> findByOrganizationIdAndStatusAndSeverityOrderByCreatedAtDesc(
        UUID organizationId, String status, String severity, Pageable pageable);

    Page<Incident> findByCreatedByIdAndStatusAndSeverityOrderByCreatedAtDesc(
        UUID createdById, String status, String severity, Pageable pageable);

    Optional<Incident> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Incident> findByIdAndCreatedById(UUID id, UUID createdById);

    long countByStatus(String status);
    long countByOrganizationId(UUID organizationId);
    long countByCreatedById(UUID createdById);
    long countByOrganizationIdAndStatus(UUID organizationId, String status);
    long countByCreatedByIdAndStatus(UUID createdById, String status);
    long countByOrganizationIdAndSeverity(UUID organizationId, String severity);
    long countByCreatedByIdAndSeverity(UUID createdById, String severity);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.status IN ('ANALYZING', 'PENDING')")
    long countActive();

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.organizationId = :organizationId AND i.status IN ('ANALYZING', 'PENDING')")
    long countActiveByOrganizationId(UUID organizationId);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.createdBy.id = :createdById AND i.status IN ('ANALYZING', 'PENDING')")
    long countActiveByCreatedById(UUID createdById);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.status = 'RESOLVED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countResolvedSince(OffsetDateTime startOfDay);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.organizationId = :organizationId AND i.status = 'RESOLVED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countResolvedSinceByOrganizationId(UUID organizationId, OffsetDateTime startOfDay);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.createdBy.id = :createdById AND i.status = 'RESOLVED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countResolvedSinceByCreatedById(UUID createdById, OffsetDateTime startOfDay);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.status = 'FAILED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countFailedSince(OffsetDateTime startOfDay);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.organizationId = :organizationId AND i.status = 'FAILED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countFailedSinceByOrganizationId(UUID organizationId, OffsetDateTime startOfDay);

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.createdBy.id = :createdById AND i.status = 'FAILED' " +
           "AND i.resolvedAt >= :startOfDay")
    long countFailedSinceByCreatedById(UUID createdById, OffsetDateTime startOfDay);

    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) " +
                   "FROM incidents WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL",
           nativeQuery = true)
    Double avgResolutionMinutes();

    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) " +
                   "FROM incidents WHERE organization_id = :organizationId AND status = 'RESOLVED' AND resolved_at IS NOT NULL",
           nativeQuery = true)
    Double avgResolutionMinutesByOrganizationId(UUID organizationId);

    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) " +
                   "FROM incidents WHERE created_by = :createdById AND status = 'RESOLVED' AND resolved_at IS NOT NULL",
           nativeQuery = true)
    Double avgResolutionMinutesByCreatedById(UUID createdById);

    // Incidents stuck in PENDING older than a threshold — for the retry scheduler
    @Query("SELECT i FROM Incident i WHERE i.status = 'PENDING' " +
           "AND i.createdAt < :threshold")
    List<Incident> findStuckPendingIncidents(OffsetDateTime threshold);
}
