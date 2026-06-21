package com.devopscopilot.backend.security;

import com.devopscopilot.backend.entity.User;
import com.devopscopilot.backend.repository.OrganizationRepository;
import com.devopscopilot.backend.repository.SystemAdminRepository;
import com.devopscopilot.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;
    private final SystemAdminRepository systemAdminRepository;
    private final OrganizationRepository organizationRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        return org.springframework.security.core.userdetails.User.builder()
            .username(user.getId().toString())
            .password(user.getPasswordHash())
            .authorities(resolveAuthorities(user))
            .accountLocked(!isAccountAccessible(user))
            .build();
    }

    private List<SimpleGrantedAuthority> resolveAuthorities(User user) {
        if (systemAdminRepository.existsByUserId(user.getId())) {
            return List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        }
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()));
    }

    private boolean isAccountAccessible(User user) {
        if (!Boolean.TRUE.equals(user.getIsActive()) || !"ACTIVE".equals(user.getAccountStatus())) {
            return false;
        }

        if (systemAdminRepository.existsByUserId(user.getId())) {
            return true;
        }

        if (user.getOrganizationId() == null) {
            return false;
        }

        return organizationRepository.findById(user.getOrganizationId())
            .map(org -> "APPROVED".equals(org.getStatus()))
            .orElse(false);
    }
}
