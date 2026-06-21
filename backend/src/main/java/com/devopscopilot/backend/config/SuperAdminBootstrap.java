package com.devopscopilot.backend.config;

import com.devopscopilot.backend.entity.SystemAdmin;
import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.SystemAdminRepository;
import com.devopscopilot.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class SuperAdminBootstrap implements CommandLineRunner {

    private final UserRepository userRepository;
    private final SystemAdminRepository systemAdminRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${APP_BOOTSTRAP_SUPER_ADMIN_EMAIL:admin@local.test}")
    private String email;

    @Value("${APP_BOOTSTRAP_SUPER_ADMIN_USERNAME:admin}")
    private String username;

    @Value("${APP_BOOTSTRAP_SUPER_ADMIN_PASSWORD:Admin123!}")
    private String password;

    @Override
    @Transactional
    public void run(String... args) {
        User admin = userRepository.findByEmail(email).orElseGet(() -> userRepository.save(User.builder()
            .username(username)
            .email(email)
            .passwordHash(passwordEncoder.encode(password))
            .role("ADMIN")
            .accountStatus("ACTIVE")
            .isActive(true)
            .build()));

        if (!systemAdminRepository.existsByUserId(admin.getId())) {
            systemAdminRepository.save(SystemAdmin.builder()
                .userId(admin.getId())
                .build());
        }

        log.info("Seeded bootstrap super admin account: {}", email);
    }
}
