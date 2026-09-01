package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.SystemAdmin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SystemAdminRepository extends JpaRepository<SystemAdmin, UUID> {
    boolean existsByUserId(UUID userId);
    Optional<SystemAdmin> findByUserId(UUID userId);
}
