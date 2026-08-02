package com.ssafy.backend.handler;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.users.LoginResponseDTO;
import com.ssafy.backend.repository.UserRepository;
import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.CookieUtil;
import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

@Component
public class LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final JWTUtil jwtUtil;
    private final CookieUtil cookieUtil;

    public LoginSuccessHandler(
            JwtService jwtService,
            JWTUtil jwtUtil,
            ObjectMapper objectMapper,
            UserRepository userRepository,
            CookieUtil cookieUtil)
    {
        this.jwtService = jwtService;
        this.objectMapper = objectMapper;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.cookieUtil = cookieUtil;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException, ServletException {

        // 1. 인증된 사용자의 email 및 Role 추출
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new UsernameNotFoundException("사용자를 찾을 수 없습니다: " + email));
        String role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_USER");

        // 2. JWT 토큰 생성 (Access / Refresh)
        String accessToken = jwtUtil.createJWT(email, role, true);
        String refreshToken = jwtUtil.createJWT(email, role, false);

        // 3. Refresh 토큰 저장소(Redis 또는 DB)에 기록
        jwtService.addRefresh(email, refreshToken);

        response.addHeader("Set-Cookie", cookieUtil.createRefreshCookie(refreshToken));

        // 4. JSON 응답 전송
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        LoginResponseDTO loginResponse =
                new LoginResponseDTO(user.getId(), accessToken);

        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.success(loginResponse)));
        response.getWriter().flush();
    }
}
