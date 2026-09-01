package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<User> findByEmailAndOrganizationId(String email, UUID organizationId);
    List<User> findByOrganizationId(UUID organizationId);
    List<User> findByOrganizationIdAndAccountStatus(UUID organizationId, String accountStatus);
}
