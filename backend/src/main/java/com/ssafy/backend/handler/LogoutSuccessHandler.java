package com.ssafy.backend.handler;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.util.StringUtils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;

public class LogoutSuccessHandler implements LogoutHandler {

    private final JwtService jwtService;
    private final JWTUtil jwtUtil;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public LogoutSuccessHandler(JwtService jwtService, JWTUtil jwtUtil) {
        this.jwtService = jwtService;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void logout(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) {
        try {
            // 1. Request Body에서 JSON 데이터 읽기
            String body = new BufferedReader(new InputStreamReader(request.getInputStream()))
                    .lines().reduce("", String::concat);

            if (!StringUtils.hasText(body)) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }

            // 2. Body 내 refreshToken 파싱
            JsonNode jsonNode = objectMapper.readTree(body);
            String refreshToken = jsonNode.has("refreshToken") ? jsonNode.get("refreshToken").asText() : null;

            // 3. 토큰 유효성 검증 (null 체크 및 JWT 서명/만료 확인)
            if (refreshToken == null || !jwtUtil.isValid(refreshToken, false)) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }

            // 4. DB에 저장되어 있던 Refresh 토큰 파기 (RTR 보안 유지)
            if (jwtService.existsRefresh(refreshToken)) {
                jwtService.removeRefresh(refreshToken);
            }

            // 5. 로그아웃 완료 응답 반환
            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"성공적으로 로그아웃 되었습니다.\"}");

        } catch (IOException e) {
            throw new RuntimeException("로그아웃 처리 중 리프레시 토큰 읽기에 실패했습니다.", e);
        }
    }
}