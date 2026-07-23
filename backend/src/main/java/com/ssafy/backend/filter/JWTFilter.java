package com.ssafy.backend.filter;

import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

public class JWTFilter extends OncePerRequestFilter {

    private final JWTUtil jwtUtil;

    public JWTFilter(JWTUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authorization = request.getHeader("Authorization");

        // Authorization 헤더가 없거나 Bearer 형식이 아니면 다음 필터로 진행 (인증이 필요 없는 public API 등)
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String accessToken = authorization.split(" ")[1];

        // Access Token 유효성 검증
        if (jwtUtil.isValid(accessToken, true)) {
            String loginId = jwtUtil.getLoginId(accessToken);
            String role = jwtUtil.getRole(accessToken);

            List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority(role));

            // SecurityContext에 인증 객체 저장
            Authentication auth = new UsernamePasswordAuthenticationToken(loginId, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);

            filterChain.doFilter(request, response);
        } else {
            // 토큰이 유효하지 않거나 만료된 경우 401 응답 후 종료
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"토큰 만료 또는 유효하지 않은 토큰\"}");
        }
    }
}