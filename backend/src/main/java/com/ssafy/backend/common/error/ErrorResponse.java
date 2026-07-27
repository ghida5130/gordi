package com.ssafy.backend.common.error;

import java.util.Map;

// 오류 JSON 구조 정의
public record ErrorResponse(
        String code,
        String message,
        Map<String, Object> details,
        String requestId,
        boolean retryable
) {

    public static ErrorResponse of(
            ErrorCode errorCode,
            String message,
            Map<String, Object> details,
            String requestId
    ) {
        return new ErrorResponse(
                errorCode.getCode(),
                message,
                details == null ? Map.of() : Map.copyOf(details),
                requestId,
                errorCode.isRetryable()
        );
    }
}
