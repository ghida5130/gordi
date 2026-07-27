package com.ssafy.backend.common.error;

import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

// 서버 로그 추적용 requestId 조회 또는 생성
public final class RequestIdUtils {

    public static final String REQUEST_ID_HEADER = "X-Request-ID";
    private static final String REQUEST_ID_ATTRIBUTE = RequestIdUtils.class.getName() + ".requestId";
    private static final int MAX_REQUEST_ID_LENGTH = 128;

    private RequestIdUtils() {
    }

    // 있으면 사용, 없으면 생성
    public static String resolve(HttpServletRequest request) {
        Object existing = request.getAttribute(REQUEST_ID_ATTRIBUTE);
        if (existing instanceof String requestId) {
            return requestId;
        }

        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank() || requestId.length() > MAX_REQUEST_ID_LENGTH) {
            requestId = UUID.randomUUID().toString();
        }

        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
        return requestId;
    }
}
