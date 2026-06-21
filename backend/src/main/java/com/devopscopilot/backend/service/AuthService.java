package com.devopscopilot.backend.service;

import com.devopscopilot.backend.dto.request.LoginRequest;
import com.devopscopilot.backend.dto.request.RegisterRequest;
import com.devopscopilot.backend.dto.response.AuthResponse;
import com.devopscopilot.backend.dto.response.UserResponse;
import com.devopscopilot.backend.entity.*;
import com.devopscopilot.backend.repository.*;
import com.devopscopilot.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RedisTemplate<String, Object> redisTemplate;
    private final OrganizationRepository organizationRepository;
    private final OrganizationRequestRepository organizationRequestRepository;
    private final OrganizationJoinRequestRepository organizationJoinRequestRepository;
    private final SystemAdminRepository systemAdminRepository;

    @Transactional
    public UserResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        }
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already taken");
        }

        String domainKey = extractDomainKey(req.getEmail());
        Organization existingOrg = organizationRepository.findByDomainKeyAndStatus(domainKey, "APPROVED").orElse(null);

        if (existingOrg != null) {
            User user = userRepository.save(User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .role("MEMBER")
                .accountStatus("PENDING")
                .isActive(false)
                .build());

            organizationJoinRequestRepository.save(OrganizationJoinRequest.builder()
                .organizationId(existingOrg.getId())
                .userId(user.getId())
                .status("PENDING")
                .build());

            log.info("Registered join request for user {} targeting org {}", user.getId(), existingOrg.getId());
            return toUserResponse(user, existingOrg.getName(), "PENDING_JOIN_APPROVAL", "MEMBER");
        }

        if (req.getOrganizationName() == null || req.getOrganizationName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organization name is required");
        }

        User user = userRepository.save(User.builder()
            .username(req.getUsername())
            .email(req.getEmail())
            .passwordHash(passwordEncoder.encode(req.getPassword()))
            .role("ORG_ADMIN")
            .accountStatus("PENDING")
            .isActive(false)
            .build());

        organizationRequestRepository.save(OrganizationRequest.builder()
            .domainKey(domainKey)
            .orgName(req.getOrganizationName())
            .requestedByUserId(user.getId())
            .status("PENDING")
            .build());

        log.info("Registered org request for user {} on domain {}", user.getId(), domainKey);
        return toUserResponse(user, req.getOrganizationName(), "PENDING_ORG_APPROVAL", "ORG_ADMIN");
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!isLoginAllowed(user)) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Account not yet approved");
        }

        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword())
            );
        } catch (AuthenticationException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        UUID organizationId = user.getOrganizationId();
        String effectiveRole = resolveEffectiveRole(user);
        String token = jwtService.generateToken(user.getId(), effectiveRole, organizationId);
        String tokenHash = jwtService.hashToken(token);
        String redisKey = "session:" + user.getId() + ":" + tokenHash;

        redisTemplate.opsForValue().set(
            redisKey,
            user.getId() + ":" + effectiveRole + ":" + OffsetDateTime.now(),
            jwtService.getExpirationMs(),
            TimeUnit.MILLISECONDS
        );

        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        log.info("User {} logged in", user.getEmail());
        return AuthResponse.builder()
            .token(token)
            .tokenType("Bearer")
            .expiresIn(jwtService.getExpirationMs() / 1000)
            .organizationId(organizationId)
            .user(toUserResponse(user, resolveOrganizationName(organizationId), null, effectiveRole))
            .build();
    }

    public void logout(String token) {
        if (token == null) return;
        try {
            String userId = jwtService.extractUserId(token);
            String tokenHash = jwtService.hashToken(token);
            redisTemplate.delete("session:" + userId + ":" + tokenHash);
            log.info("User {} logged out", userId);
        } catch (Exception e) {
            log.warn("Logout failed to clear session: {}", e.getMessage());
        }
    }

    private boolean isLoginAllowed(User user) {
        boolean isSystemAdmin = systemAdminRepository.existsByUserId(user.getId());
        if (isSystemAdmin) {
            return Boolean.TRUE.equals(user.getIsActive()) && "ACTIVE".equals(user.getAccountStatus());
        }

        if (!Boolean.TRUE.equals(user.getIsActive()) || !"ACTIVE".equals(user.getAccountStatus())) {
            return false;
        }

        UUID organizationId = user.getOrganizationId();
        if (organizationId == null) {
            return false;
        }

        return organizationRepository.findById(organizationId)
            .map(org -> "APPROVED".equals(org.getStatus()))
            .orElse(false);
    }

    private String resolveEffectiveRole(User user) {
        if (systemAdminRepository.existsByUserId(user.getId())) {
            return "SUPER_ADMIN";
        }
        return user.getRole();
    }

    private String resolveOrganizationName(UUID organizationId) {
        if (organizationId == null) {
            return null;
        }
        return organizationRepository.findById(organizationId)
            .map(Organization::getName)
            .orElse(null);
    }

    private String extractDomainKey(String email) {
        int atIndex = email.lastIndexOf('@');
        if (atIndex < 0 || atIndex == email.length() - 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid email domain");
        }
        return email.substring(atIndex + 1).trim().toLowerCase(Locale.ROOT);
    }

    private UserResponse toUserResponse(User user, String organizationName, String nextStep, String effectiveRole) {
        return UserResponse.builder()
            .id(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .role(effectiveRole)
            .organizationId(user.getOrganizationId())
            .organizationName(organizationName)
            .accountStatus(user.getAccountStatus())
            .nextStep(nextStep)
            .createdAt(user.getCreatedAt())
            .build();
    }
}
