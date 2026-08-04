package com.ssafy.backend.filter;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

/**
 * 내부 호출 전용 경로(`/internal/**`)의 서비스 키 검증.
 * <p>
 * FastAPI 가 착장 Job 이벤트 콜백을 호출할 때 `X-Internal-Api-Key` 헤더로 자신을 증명한다.
 * 이 경로는 SecurityConfig 에서 permitAll 로 열려 있으므로 접근 통제를 이 필터가 전담한다.
 * <p>
 * 헤더 이름과 키는 Spring → FastAPI 아웃바운드 호출과 같은 것을 쓴다.
 * FastAPI 쪽 검증기(`app/core/security.py`)가 `X-Internal-Api-Key` 를 보므로 양방향을 한 규약으로 맞춘다.
 * <p>
 * 키가 설정되지 않으면(빈 값) 검증하지 않는다. 로컬에서 설정 없이 붙일 수 있게 한 것이며,
 * 인바운드는 열어두면 외부에서 호출할 수 있으므로 기동 시 경고를 남긴다.
 */
@Component
public class InternalTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(InternalTokenFilter.class);

    public static final String INTERNAL_PATH_PREFIX = "/internal/";
    public static final String INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key";

    private final String internalApiKey;
    private final ApiErrorResponseWriter errorResponseWriter;

    public InternalTokenFilter(
            @Value("${gordi.ai.internal-api-key:}") String internalApiKey,
            ApiErrorResponseWriter errorResponseWriter
    ) {
        this.internalApiKey = internalApiKey;
        this.errorResponseWriter = errorResponseWriter;

        if (!StringUtils.hasText(internalApiKey)) {
            log.warn(
                    "gordi.ai.internal-api-key 가 비어 있어 {}** 경로의 서비스 키를 검증하지 않습니다.",
                    INTERNAL_PATH_PREFIX
            );
        }
    }

    // 내부 경로가 아니면 이 필터를 건너뛴다.
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(INTERNAL_PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        if (!StringUtils.hasText(internalApiKey)) {
            filterChain.doFilter(request, response);
            return;
        }

        String presented = request.getHeader(INTERNAL_API_KEY_HEADER);
        if (!matches(presented)) {
            // 어떤 값이 왔는지는 남기지 않는다.
            log.warn("Internal API key rejected. path={}, presented={}",
                    request.getRequestURI(), presented == null ? "absent" : "mismatch");
            errorResponseWriter.write(request, response, ErrorCode.UNAUTHORIZED);
            return;
        }

        filterChain.doFilter(request, response);
    }

    // 길이 노출을 막기 위해 상수 시간 비교를 사용한다.
    private boolean matches(String presented) {
        if (!StringUtils.hasText(presented)) {
            return false;
        }
        return MessageDigest.isEqual(
                presented.getBytes(StandardCharsets.UTF_8),
                internalApiKey.getBytes(StandardCharsets.UTF_8)
        );
    }
}
