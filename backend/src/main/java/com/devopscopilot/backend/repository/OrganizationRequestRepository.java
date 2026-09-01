package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.OrganizationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationRequestRepository extends JpaRepository<OrganizationRequest, UUID> {
    List<OrganizationRequest> findByDomainKeyAndStatusOrderByCreatedAtDesc(String domainKey, String status);
    List<OrganizationRequest> findByStatusOrderByCreatedAtDesc(String status);
    Optional<OrganizationRequest> findByIdAndStatus(UUID id, String status);
}
