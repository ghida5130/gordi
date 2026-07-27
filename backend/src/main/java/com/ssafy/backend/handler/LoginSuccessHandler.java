package com.ssafy.backend.handler;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Component
public class LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    private final JWTUtil jwtUtil;

    public LoginSuccessHandler(JwtService jwtService, JWTUtil jwtUtil, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.objectMapper = objectMapper;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException, ServletException {

        // 1. 인증된 사용자의 email 및 Role 추출
        String email = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_USER");

        // 2. JWT 토큰 생성 (Access / Refresh)
        String accessToken = jwtUtil.createJWT(email, role, true);
        String refreshToken = jwtUtil.createJWT(email, role, false);

        // 3. Refresh 토큰 저장소(Redis 또는 DB)에 기록
        jwtService.addRefresh(email, refreshToken);

        // 4. JSON 응답 전송
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        Map<String, String> tokenMap = new HashMap<>();
        tokenMap.put("accessToken", accessToken);
        tokenMap.put("refreshToken", refreshToken);

        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.success(tokenMap)));
        response.getWriter().flush();
    }
}
