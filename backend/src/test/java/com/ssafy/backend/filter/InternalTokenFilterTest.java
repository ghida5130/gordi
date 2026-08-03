package com.ssafy.backend.filter;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ErrorCode;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class InternalTokenFilterTest {

    private static final String TOKEN = "s3cr3t-service-token";
    private static final String EVENTS_PATH = "/internal/v1/try-on-jobs/71/events";

    @Mock
    private FilterChain filterChain;

    private final ApiErrorResponseWriter errorResponseWriter =
            new ApiErrorResponseWriter(new ObjectMapper());

    @Test
    void 올바른_토큰이면_통과한다() throws Exception {
        InternalTokenFilter filter = new InternalTokenFilter(TOKEN, errorResponseWriter);
        MockHttpServletRequest request = internalRequest();
        request.addHeader(InternalTokenFilter.INTERNAL_TOKEN_HEADER, TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void 토큰_헤더가_없으면_401이고_체인을_타지_않는다() throws Exception {
        InternalTokenFilter filter = new InternalTokenFilter(TOKEN, errorResponseWriter);
        MockHttpServletRequest request = internalRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain, never()).doFilter(any(), any());
        assertThat(response.getStatus()).isEqualTo(ErrorCode.UNAUTHORIZED.getStatus().value());
        assertThat(response.getContentAsString()).contains(ErrorCode.UNAUTHORIZED.getCode());
    }

    @Test
    void 토큰이_다르면_401이다() throws Exception {
        InternalTokenFilter filter = new InternalTokenFilter(TOKEN, errorResponseWriter);
        MockHttpServletRequest request = internalRequest();
        request.addHeader(InternalTokenFilter.INTERNAL_TOKEN_HEADER, "wrong-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain, never()).doFilter(any(), any());
        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void 토큰이_설정되지_않으면_검증하지_않는다() throws Exception {
        InternalTokenFilter filter = new InternalTokenFilter("", errorResponseWriter);
        MockHttpServletRequest request = internalRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void 내부_경로가_아니면_토큰을_요구하지_않는다() throws Exception {
        InternalTokenFilter filter = new InternalTokenFilter(TOKEN, errorResponseWriter);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/try-on-jobs/71");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    private MockHttpServletRequest internalRequest() {
        return new MockHttpServletRequest("POST", EVENTS_PATH);
    }
}
