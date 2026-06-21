package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.OrganizationJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationJoinRequestRepository extends JpaRepository<OrganizationJoinRequest, UUID> {
    List<OrganizationJoinRequest> findByOrganizationIdAndStatusOrderByCreatedAtDesc(UUID organizationId, String status);
    Optional<OrganizationJoinRequest> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);
    Optional<OrganizationJoinRequest> findByIdAndOrganizationIdAndStatus(UUID id, UUID organizationId, String status);
}
