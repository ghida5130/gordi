package com.ssafy.backend.handler;

import com.ssafy.backend.util.CookieUtil;
import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.LogoutHandler;


public class LogoutSuccessHandler implements LogoutHandler {

    private final JwtService jwtService;
    private final JWTUtil jwtUtil;
    private final CookieUtil cookieUtil;

    public LogoutSuccessHandler(
            JwtService jwtService,
            JWTUtil jwtUtil,
            CookieUtil cookieUtil
    ) {
        this.jwtService = jwtService;
        this.jwtUtil = jwtUtil;
        this.cookieUtil = cookieUtil;
    }

    @Override
    public void logout(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) {
        // 1. 쿠키에서 refreshToken 추출
        String refreshToken = CookieUtil.extractRefreshToken(request);

        // 2. 유효하고 DB에 있으면 파기 (RTR 유지)
        if (refreshToken != null
                && jwtUtil.isValid(refreshToken, false)
                && jwtService.existsRefresh(refreshToken)) {
            jwtService.removeRefresh(refreshToken);
        }

        // 3. 브라우저 쿠키 삭제
        response.addHeader("Set-Cookie", cookieUtil.deleteRefreshCookie());

        // 4. 204 No Content
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }
}
