package com.ssafy.backend.filter;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ErrorCode;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// IP당 로그인 시도를 분당 5회로 제한하는 필터 (브루트포스 방어)
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final int LIMIT_PER_MINUTE = 5;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final ApiErrorResponseWriter errorResponseWriter;

    public LoginRateLimitFilter(ApiErrorResponseWriter errorResponseWriter) {
        this.errorResponseWriter = errorResponseWriter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 로그인은 POST만 존재 — 그 외 메서드는 통과
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(clientIp, ip -> newBucket());

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            errorResponseWriter.write(request, response, ErrorCode.TOO_MANY_REQUESTS);
        }
    }

    // 분당 5개 토큰, 실패/성공 관계없이 시도 자체를 소모
    private Bucket newBucket() {
        return Bucket.builder()
                .addLimit(limit -> limit
                        .capacity(LIMIT_PER_MINUTE)
                        .refillGreedy(LIMIT_PER_MINUTE, Duration.ofMinutes(1)))
                .build();
    }

    // nginx 뒤에 있으므로 X-Forwarded-For 우선, 없으면 직접 연결 IP
    private String resolveClientIp(HttpServletRequest request) {
        String realIp  = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp;
        }
        return request.getRemoteAddr();
    }
}