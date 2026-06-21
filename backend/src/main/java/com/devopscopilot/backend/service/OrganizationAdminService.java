package com.devopscopilot.backend.service;

import com.devopscopilot.backend.dto.request.RejectRequest;
import com.devopscopilot.backend.dto.response.OrganizationJoinRequestResponse;
import com.devopscopilot.backend.dto.response.OrganizationRequestResponse;
import com.devopscopilot.backend.dto.response.OrganizationResponse;
import com.devopscopilot.backend.entity.OrganizationJoinRequest;
import com.devopscopilot.backend.entity.Organization;
import com.devopscopilot.backend.entity.OrganizationRequest;
import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.OrganizationJoinRequestRepository;
import com.devopscopilot.backend.repository.OrganizationRepository;
import com.devopscopilot.backend.repository.OrganizationRequestRepository;
import com.devopscopilot.backend.repository.SystemAdminRepository;
import com.devopscopilot.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationAdminService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationRequestRepository organizationRequestRepository;
    private final OrganizationJoinRequestRepository organizationJoinRequestRepository;
    private final SystemAdminRepository systemAdminRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<OrganizationRequestResponse> listPendingRequests(String userId) {
        assertSuperAdmin(userId);
        return organizationRequestRepository.findByStatusOrderByCreatedAtDesc("PENDING").stream()
            .map(this::toRequestResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<OrganizationResponse> listApprovedOrganizations(String userId) {
        assertSuperAdmin(userId);
        return organizationRepository.findByStatusOrderByCreatedAtDesc("APPROVED").stream()
            .map(this::toOrgResponse)
            .toList();
    }

    @Transactional
    public OrganizationResponse approveRequest(String userId, UUID requestId) {
        assertSuperAdmin(userId);

        OrganizationRequest request = organizationRequestRepository.findByIdAndStatus(requestId, "PENDING")
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization request not found"));

        String domainKey = normalizeDomain(request.getDomainKey());
        if (organizationRepository.existsByDomainKey(domainKey)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Domain already has an approved organization");
        }

        User owner = userRepository.findById(request.getRequestedByUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requesting user not found"));

        Organization org = organizationRepository.save(Organization.builder()
            .domainKey(domainKey)
            .name(request.getOrgName())
            .ownerUserId(owner.getId())
            .status("APPROVED")
            .approvedByUserId(UUID.fromString(userId))
            .approvedAt(OffsetDateTime.now())
            .build());

        request.setStatus("APPROVED");
        request.setApprovedByUserId(UUID.fromString(userId));
        request.setApprovedOrganizationId(org.getId());
        organizationRequestRepository.save(request);

        owner.setOrganizationId(org.getId());
        owner.setAccountStatus("ACTIVE");
        owner.setIsActive(true);
        owner.setRole("ORG_ADMIN");
        userRepository.save(owner);

        autoRejectDuplicateRequests(domainKey, request.getId(), userId);

        log.info("Approved organization request {} into org {}", requestId, org.getId());
        return toOrgResponse(org);
    }

    @Transactional
    public OrganizationRequestResponse rejectRequest(String userId, UUID requestId, RejectRequest rejectRequest) {
        assertSuperAdmin(userId);

        OrganizationRequest request = organizationRequestRepository.findByIdAndStatus(requestId, "PENDING")
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization request not found"));

        User owner = userRepository.findById(request.getRequestedByUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requesting user not found"));

        request.setStatus("REJECTED");
        request.setRejectedByUserId(UUID.fromString(userId));
        request.setRejectionReason(rejectRequest.getReason());
        organizationRequestRepository.save(request);

        owner.setAccountStatus("REJECTED");
        owner.setIsActive(false);
        userRepository.save(owner);

        log.info("Rejected organization request {}", requestId);
        return toRequestResponse(request);
    }

    @Transactional(readOnly = true)
    public List<OrganizationJoinRequestResponse> listPendingJoinRequests(String userId) {
        User admin = requireOrgAdmin(userId);
        UUID organizationId = requireOrganizationId(admin);
        return organizationJoinRequestRepository
            .findByOrganizationIdAndStatusOrderByCreatedAtDesc(organizationId, "PENDING")
            .stream()
            .map(request -> toJoinRequestResponse(request, userRepository.findById(request.getUserId()).orElse(null)))
            .toList();
    }

    @Transactional
    public OrganizationJoinRequestResponse approveJoinRequest(String userId, UUID joinRequestId) {
        User admin = requireOrgAdmin(userId);
        UUID organizationId = requireOrganizationId(admin);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
        if (!"APPROVED".equals(org.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization is not approved yet");
        }

        OrganizationJoinRequest request = organizationJoinRequestRepository
            .findByIdAndOrganizationIdAndStatus(joinRequestId, organizationId, "PENDING")
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Join request not found"));

        User joiner = userRepository.findById(request.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Joining user not found"));

        request.setStatus("APPROVED");
        request.setApprovedByUserId(UUID.fromString(userId));
        organizationJoinRequestRepository.save(request);

        joiner.setOrganizationId(organizationId);
        joiner.setAccountStatus("ACTIVE");
        joiner.setIsActive(true);
        joiner.setRole("MEMBER");
        userRepository.save(joiner);

        log.info("Approved join request {} for organization {}", joinRequestId, organizationId);
        return toJoinRequestResponse(request, joiner);
    }

    @Transactional
    public OrganizationJoinRequestResponse rejectJoinRequest(String userId, UUID joinRequestId, RejectRequest rejectRequest) {
        User admin = requireOrgAdmin(userId);
        UUID organizationId = requireOrganizationId(admin);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
        if (!"APPROVED".equals(org.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization is not approved yet");
        }

        OrganizationJoinRequest request = organizationJoinRequestRepository
            .findByIdAndOrganizationIdAndStatus(joinRequestId, organizationId, "PENDING")
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Join request not found"));

        User joiner = userRepository.findById(request.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Joining user not found"));

        request.setStatus("REJECTED");
        request.setRejectedByUserId(UUID.fromString(userId));
        request.setRejectionReason(rejectRequest.getReason());
        organizationJoinRequestRepository.save(request);

        joiner.setAccountStatus("REJECTED");
        joiner.setIsActive(false);
        userRepository.save(joiner);

        log.info("Rejected join request {}", joinRequestId);
        return toJoinRequestResponse(request, joiner);
    }

    private void autoRejectDuplicateRequests(String domainKey, UUID approvedRequestId, String userId) {
        organizationRequestRepository.findByDomainKeyAndStatusOrderByCreatedAtDesc(domainKey, "PENDING").stream()
            .filter(request -> !request.getId().equals(approvedRequestId))
            .forEach(request -> {
                request.setStatus("REJECTED");
                request.setRejectedByUserId(UUID.fromString(userId));
                request.setRejectionReason("Another request for this domain was approved");
                organizationRequestRepository.save(request);

                userRepository.findById(request.getRequestedByUserId()).ifPresent(user -> {
                    user.setAccountStatus("REJECTED");
                    user.setIsActive(false);
                    userRepository.save(user);
                });
            });
    }

    private void assertSuperAdmin(String userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        UUID parsedUserId = UUID.fromString(userId);
        if (!systemAdminRepository.existsByUserId(parsedUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Super admin access required");
        }
    }

    private User requireOrgAdmin(String userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        UUID parsedUserId = UUID.fromString(userId);
        User user = userRepository.findById(parsedUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (!"ORG_ADMIN".equals(user.getRole()) || user.getOrganizationId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Org admin access required");
        }

        Organization org = organizationRepository.findById(user.getOrganizationId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization not found"));
        if (!"APPROVED".equals(org.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization is not approved yet");
        }

        return user;
    }

    private UUID requireOrganizationId(User user) {
        if (user.getOrganizationId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization required");
        }
        return user.getOrganizationId();
    }

    private String normalizeDomain(String domainKey) {
        return domainKey == null ? null : domainKey.trim().toLowerCase(Locale.ROOT);
    }

    private OrganizationResponse toOrgResponse(Organization org) {
        return OrganizationResponse.builder()
            .id(org.getId())
            .domainKey(org.getDomainKey())
            .name(org.getName())
            .ownerUserId(org.getOwnerUserId())
            .status(org.getStatus())
            .approvedByUserId(org.getApprovedByUserId())
            .approvedAt(org.getApprovedAt())
            .createdAt(org.getCreatedAt())
            .build();
    }

    private OrganizationRequestResponse toRequestResponse(OrganizationRequest request) {
        return OrganizationRequestResponse.builder()
            .id(request.getId())
            .domainKey(request.getDomainKey())
            .orgName(request.getOrgName())
            .requestedByUserId(request.getRequestedByUserId())
            .status(request.getStatus())
            .rejectionReason(request.getRejectionReason())
            .approvedOrganizationId(request.getApprovedOrganizationId())
            .createdAt(request.getCreatedAt())
            .build();
    }

    private OrganizationJoinRequestResponse toJoinRequestResponse(OrganizationJoinRequest request, User user) {
        return OrganizationJoinRequestResponse.builder()
            .id(request.getId())
            .organizationId(request.getOrganizationId())
            .userId(request.getUserId())
            .username(user != null ? user.getUsername() : null)
            .email(user != null ? user.getEmail() : null)
            .status(request.getStatus())
            .rejectionReason(request.getRejectionReason())
            .createdAt(request.getCreatedAt())
            .build();
    }
}
