package com.devopscopilot.backend.service;

import com.devopscopilot.backend.dto.request.LoginRequest;
import com.devopscopilot.backend.dto.request.RegisterRequest;
import com.devopscopilot.backend.dto.response.AuthResponse;
import com.devopscopilot.backend.dto.response.UserResponse;
import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.UserRepository;
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

    @Transactional
    public UserResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Email already registered");
        }
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Username already taken");
        }

        User user = User.builder()
            .username(req.getUsername())
            .email(req.getEmail())
            .passwordHash(passwordEncoder.encode(req.getPassword()))
            .role(req.getRole())
            .build();

        user = userRepository.save(user);
        log.info("Registered user {} ({})", user.getUsername(), user.getId());
        return toUserResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword())
            );
        } catch (AuthenticationException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        User user = userRepository.findByEmail(req.getEmail())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                "Invalid credentials"));

        if (!user.getIsActive()) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Account deactivated");
        }

        String token    = jwtService.generateToken(user.getId(), user.getRole());
        String tokenHash = jwtService.hashToken(token);
        String redisKey = "session:" + user.getId() + ":" + tokenHash;

        redisTemplate.opsForValue().set(
            redisKey,
            user.getId() + ":" + user.getRole() + ":" + OffsetDateTime.now(),
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
            .user(toUserResponse(user))
            .build();
    }

    public void logout(String token) {
        if (token == null) return;
        try {
            String userId    = jwtService.extractUserId(token);
            String tokenHash = jwtService.hashToken(token);
            redisTemplate.delete("session:" + userId + ":" + tokenHash);
            log.info("User {} logged out", userId);
        } catch (Exception e) {
            log.warn("Logout failed to clear session: {}", e.getMessage());
        }
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
            .id(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .role(user.getRole())
            .createdAt(user.getCreatedAt())
            .build();
    }
}
