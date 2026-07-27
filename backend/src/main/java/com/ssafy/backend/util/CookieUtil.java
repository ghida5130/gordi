package com.ssafy.backend.util;

import org.springframework.http.ResponseCookie;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;

public class CookieUtil {
    public static final String REFRESH_COOKIE_NAME = "refreshToken";

    // 로컬 개발(http)에서는 SECURE=false 로. 운영(https)은 true.
    // 제대로 하려면 @Value 로 주입받는 인스턴스 방식으로 바꾸는 게 좋다.
    private static final boolean SECURE = false;
    private static final String SAME_SITE = "Strict";   // 크로스도메인이면 "None"
    private static final Duration MAX_AGE = Duration.ofDays(14);

    private CookieUtil() {}

    // 새 refresh 쿠키 문자열 생성
    public static String createRefreshCookie(String refreshToken) {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(SECURE)
                .path("/")
                .sameSite(SAME_SITE)
                .maxAge(MAX_AGE)
                .build()
                .toString();
    }

    // 로그아웃용: 빈 값 + maxAge 0 으로 브라우저 쿠키 삭제 유도
    public static String deleteRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(SECURE)
                .path("/")
                .sameSite(SAME_SITE)
                .maxAge(0)
                .build()
                .toString();
    }

    // 요청 쿠키에서 refreshToken 값 꺼내기 (없으면 null)
    public static String extractRefreshToken(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (REFRESH_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
