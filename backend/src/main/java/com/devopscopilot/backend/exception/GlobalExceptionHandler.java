package com.devopscopilot.backend.exception;

import com.devopscopilot.backend.dto.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<Map<String, String>> fields = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> Map.of("field", e.getField(), "message", defaultMessage(e)))
            .toList();

        ApiResponse<Void> body = ApiResponse.<Void>builder()
            .success(false)
            .error(ApiResponse.ErrorBody.builder()
                .code("VALIDATION_ERROR")
                .message("Request validation failed")
                .fields(fields)
                .build())
            .timestamp(java.time.OffsetDateTime.now().toString())
            .build();

        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(IncidentNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(IncidentNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiResponse.fail("INCIDENT_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
            .body(ApiResponse.fail(ex.getStatusCode().toString(), ex.getReason()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ApiResponse.fail("FORBIDDEN", "Access denied"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleAll(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.fail("INTERNAL_ERROR", "Something went wrong on our end. Please try again."));
    }

    private String defaultMessage(FieldError error) {
        return error.getDefaultMessage() != null
            ? error.getDefaultMessage()
            : "Invalid value";
    }
}
