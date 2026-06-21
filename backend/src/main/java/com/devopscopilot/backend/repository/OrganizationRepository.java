package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.Organization;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
    Optional<Organization> findByDomainKey(String domainKey);
    Optional<Organization> findByDomainKeyAndStatus(String domainKey, String status);
    boolean existsByDomainKey(String domainKey);
    List<Organization> findByStatusOrderByCreatedAtDesc(String status);
    List<Organization> findByStatus(String status, Sort sort);
}
