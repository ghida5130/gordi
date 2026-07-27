package com.ssafy.backend.common.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Map;

// Security 필터에서 오류 JSON을 HttpServletResponse에서 직접 작성
// (JWT 만료, 로그인 실패, 인증되지 않은 접근, 권한 부족, 로그아웃 토큰 오류)
@Component
public class ApiErrorResponseWriter {

    private final ObjectMapper objectMapper;

    public ApiErrorResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            ErrorCode errorCode
    ) throws IOException {
        write(request, response, errorCode, errorCode.getMessage(), Map.of());
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            ErrorCode errorCode,
            String message,
            Map<String, Object> details
    ) throws IOException {
        String requestId = RequestIdUtils.resolve(request);
        ErrorResponse body = ErrorResponse.of(errorCode, message, details, requestId);

        response.setStatus(errorCode.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader(RequestIdUtils.REQUEST_ID_HEADER, requestId); // response.setHeader("X-Request-ID", requestId);
        objectMapper.writeValue(response.getWriter(), body);
    }
}
