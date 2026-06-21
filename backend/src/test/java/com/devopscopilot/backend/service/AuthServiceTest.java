package com.devopscopilot.backend.service;

import com.devopscopilot.backend.dto.request.RegisterRequest;
import com.devopscopilot.backend.dto.response.UserResponse;
import com.devopscopilot.backend.entity.Organization;
import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.*;
import com.devopscopilot.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationRequestRepository organizationRequestRepository;
    @Mock private OrganizationJoinRequestRepository organizationJoinRequestRepository;
    @Mock private SystemAdminRepository systemAdminRepository;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
            userRepository,
            passwordEncoder,
            jwtService,
            authenticationManager,
            redisTemplate,
            organizationRepository,
            organizationRequestRepository,
            organizationJoinRequestRepository,
            systemAdminRepository
        );

        lenient().when(passwordEncoder.encode(any())).thenAnswer(invocation -> "hashed-" + invocation.getArgument(0));
    }

    @Test
    void registerWhenApprovedOrgCreatesPendingJoinRequest() {
        Organization org = Organization.builder()
            .id(java.util.UUID.fromString("11111111-1111-1111-1111-111111111111"))
            .name("Acme")
            .domainKey("acme.com")
            .status("APPROVED")
            .build();

        when(userRepository.existsByEmail("jane@acme.com")).thenReturn(false);
        when(userRepository.existsByUsername("jane")).thenReturn(false);
        when(organizationRepository.findByDomainKeyAndStatus("acme.com", "APPROVED"))
            .thenReturn(Optional.of(org));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(organizationJoinRequestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = authService.register(registerRequest(null));

        assertThat(response.getRole()).isEqualTo("MEMBER");
        assertThat(response.getNextStep()).isEqualTo("PENDING_JOIN_APPROVAL");
        assertThat(response.getAccountStatus()).isEqualTo("PENDING");
        assertThat(response.getOrganizationName()).isEqualTo("Acme");
        verify(organizationJoinRequestRepository, times(1)).save(any());
        verify(organizationRequestRepository, never()).save(any());
    }

    @Test
    void registerWhenNoApprovedOrgCreatesOrgRequest() {
        when(userRepository.existsByEmail("jane@newco.com")).thenReturn(false);
        when(userRepository.existsByUsername("jane")).thenReturn(false);
        when(organizationRepository.findByDomainKeyAndStatus("newco.com", "APPROVED"))
            .thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(organizationRequestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = authService.register(registerRequest("NewCo"));

        assertThat(response.getRole()).isEqualTo("ORG_ADMIN");
        assertThat(response.getNextStep()).isEqualTo("PENDING_ORG_APPROVAL");
        assertThat(response.getAccountStatus()).isEqualTo("PENDING");
        assertThat(response.getOrganizationName()).isEqualTo("NewCo");
        verify(organizationRequestRepository, times(1)).save(any());
        verify(organizationJoinRequestRepository, never()).save(any());
    }

    @Test
    void loginBlocksUsersFromSuspendedOrganizations() {
        java.util.UUID userId = java.util.UUID.fromString("33333333-3333-3333-3333-333333333333");
        java.util.UUID orgId = java.util.UUID.fromString("44444444-4444-4444-4444-444444444444");
        User user = User.builder()
            .id(userId)
            .username("jane")
            .email("jane@acme.com")
            .passwordHash("hashed-password")
            .role("MEMBER")
            .organizationId(orgId)
            .accountStatus("ACTIVE")
            .isActive(true)
            .build();
        Organization suspendedOrg = Organization.builder()
            .id(orgId)
            .name("Acme")
            .domainKey("acme.com")
            .status("SUSPENDED")
            .build();

        when(userRepository.findByEmail("jane@acme.com")).thenReturn(Optional.of(user));
        when(systemAdminRepository.existsByUserId(userId)).thenReturn(false);
        when(organizationRepository.findById(orgId)).thenReturn(Optional.of(suspendedOrg));

        assertThatThrownBy(() -> authService.login(loginRequest("jane@acme.com")))
            .isInstanceOf(ResponseStatusException.class)
            .extracting(ex -> ((ResponseStatusException) ex).getStatusCode().value())
            .isEqualTo(423);

        verify(authenticationManager, never()).authenticate(any());
        verify(jwtService, never()).generateToken(any(), any(), any());
    }

    @Test
    void loginAllowsSuperAdminWithoutOrganization() {
        java.util.UUID userId = java.util.UUID.fromString("55555555-5555-5555-5555-555555555555");
        User user = User.builder()
            .id(userId)
            .username("root")
            .email("root@example.com")
            .passwordHash("hashed-password")
            .role("ADMIN")
            .accountStatus("ACTIVE")
            .isActive(true)
            .build();

        when(userRepository.findByEmail("root@example.com")).thenReturn(Optional.of(user));
        when(systemAdminRepository.existsByUserId(userId)).thenReturn(true);
        when(authenticationManager.authenticate(any())).thenReturn(null);
        when(jwtService.generateToken(eq(userId), eq("SUPER_ADMIN"), isNull())).thenReturn("token");
        when(jwtService.hashToken("token")).thenReturn("hash");
        when(jwtService.getExpirationMs()).thenReturn(60000L);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        authService.login(loginRequest("root@example.com"));

        verify(authenticationManager, times(1)).authenticate(any());
        verify(jwtService, times(1)).generateToken(eq(userId), eq("SUPER_ADMIN"), isNull());
    }

    private RegisterRequest registerRequest(String organizationName) {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("jane");
        req.setEmail("jane@" + ("NewCo".equals(organizationName) ? "newco.com" : "acme.com"));
        req.setPassword("Password1");
        req.setOrganizationName(organizationName);
        return req;
    }

    private com.devopscopilot.backend.dto.request.LoginRequest loginRequest(String email) {
        com.devopscopilot.backend.dto.request.LoginRequest req = new com.devopscopilot.backend.dto.request.LoginRequest();
        req.setEmail(email);
        req.setPassword("Password1");
        return req;
    }
}
