package com.ssafy.backend.filter;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.util.JWTUtil;
import com.ssafy.backend.util.RoomTokenProvider;
import com.ssafy.backend.websocket.RoomPrincipal;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class JWTFilterTest {

    private static final String SECRET =
            "jwt-filter-test-secret-key-with-at-least-32-bytes";

    private JWTUtil jwtUtil;
    private RoomTokenProvider roomTokenProvider;
    private ApiErrorResponseWriter errorResponseWriter;
    private JWTFilter jwtFilter;

    @BeforeEach
    void setUp() {
        jwtUtil = new JWTUtil(SECRET, 3_600_000L, 7_200_000L);
        roomTokenProvider = new RoomTokenProvider(SECRET, 3_600_000L);
        errorResponseWriter = mock(ApiErrorResponseWriter.class);
        jwtFilter = new JWTFilter(jwtUtil, roomTokenProvider, errorResponseWriter);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void accessToken이면_이메일과_ROLE_USER로_인증객체를_생성한다() throws Exception {
        String token = jwtUtil.createJWT("user@example.com", "ROLE_USER", true);
        MockHttpServletRequest request = bearerRequest(token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = mock(FilterChain.class);

        jwtFilter.doFilter(request, response, filterChain);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getPrincipal()).isEqualTo("user@example.com");
        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_USER");
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void roomToken이면_전역권한없이_RoomPrincipal로_인증객체를_생성한다() throws Exception {
        String token = roomTokenProvider.createRoomToken(
                42L,
                31L,
                "친구1",
                "PARTICIPANTS",
                LocalDateTime.now(AppZone.KST).plusHours(1)
        );
        MockHttpServletRequest request = bearerRequest(token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = mock(FilterChain.class);

        jwtFilter.doFilter(request, response, filterChain);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getPrincipal()).isEqualTo(new RoomPrincipal(
                42L,
                31L,
                "친구1",
                "PARTICIPANTS"
        ));
        assertThat(authentication.getAuthorities()).isEmpty();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void 만료된_토큰이면_TOKEN_EXPIRED를_응답하고_필터체인을_진행하지_않는다() throws Exception {
        JWTUtil expiredTokenIssuer = new JWTUtil(SECRET, -1L, 7_200_000L);
        String token = expiredTokenIssuer.createJWT("user@example.com", "ROLE_USER", true);
        MockHttpServletRequest request = bearerRequest(token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = mock(FilterChain.class);

        jwtFilter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(errorResponseWriter).write(request, response, ErrorCode.TOKEN_EXPIRED);
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    void 잘못된_토큰이면_INVALID_TOKEN을_응답하고_필터체인을_진행하지_않는다() throws Exception {
        MockHttpServletRequest request = bearerRequest("not-a-jwt");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = mock(FilterChain.class);

        jwtFilter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(errorResponseWriter).write(request, response, ErrorCode.INVALID_TOKEN);
        verify(filterChain, never()).doFilter(request, response);
    }

    private MockHttpServletRequest bearerRequest(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }
}
