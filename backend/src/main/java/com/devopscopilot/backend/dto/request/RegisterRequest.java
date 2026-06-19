package com.devopscopilot.backend.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank @Size(min = 3, max = 100)
    private String username;

    @NotBlank @Email
    private String email;

    @NotBlank
    @Size(min = 8)
    @Pattern(regexp = "^(?=.*[A-Z])(?=.*\\d).+$",
             message = "Password must contain at least one uppercase letter and one digit")
    private String password;

    @NotBlank @Pattern(regexp = "DEVELOPER|ADMIN",
                       message = "Role must be DEVELOPER or ADMIN")
    private String role;
}
