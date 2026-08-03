package com.ssafy.backend.filter;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.util.JWTUtil;
import com.ssafy.backend.util.RoomTokenProvider;
import com.ssafy.backend.websocket.RoomPrincipal;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JWTFilter extends OncePerRequestFilter {

    private final JWTUtil jwtUtil;
    private final RoomTokenProvider roomTokenProvider;
    private final ApiErrorResponseWriter errorResponseWriter;

    public JWTFilter(
            JWTUtil jwtUtil,
            RoomTokenProvider roomTokenProvider,
            ApiErrorResponseWriter errorResponseWriter
    ) {
        this.jwtUtil = jwtUtil;
        this.roomTokenProvider = roomTokenProvider;
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

        String token = authorization.substring("Bearer ".length()).trim();

        try {
            String tokenType = jwtUtil.getType(token);

            switch (tokenType) {
                case "access" -> setAccessAuthentication(token);
                case "room" -> setRoomAuthentication(token);
                default -> throw new ApiException(
                        ErrorCode.INVALID_TOKEN
                );
            }
            filterChain.doFilter(request, response);

        } catch (ExpiredJwtException exception) {
            errorResponseWriter.write(
                    request,
                    response,
                    ErrorCode.TOKEN_EXPIRED
            );
        } catch (ApiException exception) {
            errorResponseWriter.write(
                    request,
                    response,
                    exception.getErrorCode()
            );
        } catch (JwtException | IllegalArgumentException exception) {
            errorResponseWriter.write(
                    request,
                    response,
                    ErrorCode.INVALID_TOKEN
            );
        }
    }

    private void setAccessAuthentication(String token) {
        if (!jwtUtil.isValid(token, true)) {
            throw new ApiException(ErrorCode.INVALID_TOKEN);
        }

        String email = jwtUtil.getEmail(token);
        String role = jwtUtil.getRole(token);

        Authentication authentication = new UsernamePasswordAuthenticationToken(
                email,
                null,
                List.of(new SimpleGrantedAuthority(role))
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private void setRoomAuthentication(String token) {
        RoomTokenProvider.RoomClaims claims = roomTokenProvider.parse(token);

        RoomPrincipal principal = new RoomPrincipal(
                claims.participantId(),
                claims.roomId(),
                claims.nickname(),
                claims.role()
        );

        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of() // 전역 권한 없음
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
