package com.ssafy.backend.common.error;

import java.util.Map;

public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;
    private final Map<String, Object> details;

    public ApiException(ErrorCode errorCode) {
        this(errorCode, errorCode.getMessage(), Map.of());
    }

    public ApiException(ErrorCode errorCode, Map<String, Object> details) {
        this(errorCode, errorCode.getMessage(), details);
    }

    public ApiException(ErrorCode errorCode, String message) {
        this(errorCode, message, Map.of());
    }

    public ApiException(ErrorCode errorCode, String message, Map<String, Object> details) {
        super(message);
        this.errorCode = errorCode;
        this.details = details == null ? Map.of() : Map.copyOf(details);
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
