package com.devopscopilot.backend.controller;

import com.devopscopilot.backend.dto.request.LoginRequest;
import com.devopscopilot.backend.dto.request.RegisterRequest;
import com.devopscopilot.backend.dto.response.ApiResponse;
import com.devopscopilot.backend.dto.response.AuthResponse;
import com.devopscopilot.backend.dto.response.UserResponse;
import com.devopscopilot.backend.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${jwt.expiration-ms}")
    private long jwtExpirationMs;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponse>> register(
            @Valid @RequestBody RegisterRequest req) {
        UserResponse user = authService.register(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(user));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletResponse response) {
        AuthResponse auth = authService.login(req);

        // Set HTTP-only cookie
        Cookie cookie = new Cookie("jwt", auth.getToken());
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // set true in production with HTTPS
        cookie.setPath("/");
        cookie.setMaxAge((int) (jwtExpirationMs / 1000));
        response.addCookie(cookie);

        return ResponseEntity.ok(ApiResponse.ok(auth));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Object>> logout(
            HttpServletRequest request,
            HttpServletResponse response) {
        String token = extractTokenFromCookie(request);
        authService.logout(token);

        // Expire the cookie
        Cookie cookie = new Cookie("jwt", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok(ApiResponse.ok(java.util.Map.of("message", "Logged out successfully")));
    }

    private String extractTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
            .filter(c -> "jwt".equals(c.getName()))
            .map(Cookie::getValue)
            .findFirst()
            .orElse(null);
    }
}
