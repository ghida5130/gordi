package com.ssafy.backend.filter;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ErrorCode;
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
    private final ApiErrorResponseWriter errorResponseWriter;

    public JWTFilter(JWTUtil jwtUtil, ApiErrorResponseWriter errorResponseWriter) {
        this.jwtUtil = jwtUtil;
        this.errorResponseWriter = errorResponseWriter;
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

        // Access Token 유효성 검증 _ 만료 여부 확인
        if (jwtUtil.isValid(accessToken, true)) {
            String email = jwtUtil.getEmail(accessToken);
            String role = jwtUtil.getRole(accessToken);

            List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority(role));

            // SecurityContext에 인증 객체 저장
            Authentication auth = new UsernamePasswordAuthenticationToken(email, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);

            filterChain.doFilter(request, response);
        } else { // 토큰이 유효하지 않은 경우 TOKEN_EXPIRED
            ErrorCode errorCode = jwtUtil.isExpired(accessToken)
                    ? ErrorCode.TOKEN_EXPIRED
                    : ErrorCode.INVALID_TOKEN;
            errorResponseWriter.write(request, response, errorCode);
        }
    }
}
