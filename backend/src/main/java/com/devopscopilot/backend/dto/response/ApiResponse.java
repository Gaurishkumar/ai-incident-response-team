package com.devopscopilot.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean success;
    private T data;
    private ErrorBody error;
    private String timestamp;

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder()
            .success(true)
            .data(data)
            .timestamp(OffsetDateTime.now().toString())
            .build();
    }

    public static <T> ApiResponse<T> fail(String code, String message) {
        return ApiResponse.<T>builder()
            .success(false)
            .error(ErrorBody.builder().code(code).message(message).build())
            .timestamp(OffsetDateTime.now().toString())
            .build();
    }

    @Data @Builder
    public static class ErrorBody {
        private String code;
        private String message;
        private Object fields;
    }
}
