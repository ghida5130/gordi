package com.ssafy.backend.handler;

import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.CookieUtil;
import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final JWTUtil jwtUtil;
    private final String redirectUrl;
    private final CookieUtil cookieUtil;

    public OAuth2SuccessHandler(
            JwtService jwtService,
            JWTUtil jwtUtil,
            CookieUtil cookieUtil,
            @Value("${oauth2.redirect-url}") String redirectUrl
    ) {
        this.jwtService = jwtService;
        this.jwtUtil = jwtUtil;
        this.redirectUrl = redirectUrl;
        this.cookieUtil = cookieUtil;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {

        String email = authentication.getName(); // CustomOAuth2UserService에서 email로 지정함
        String role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_USER");

        // Refresh 토큰만 생성해 쿠키로 전달. Access 토큰은 프론트가 /auth/refresh로 받아감
        String refreshToken = jwtUtil.createJWT(email, role, false);
        jwtService.addRefresh(email, refreshToken);

        response.addHeader("Set-Cookie", cookieUtil.createRefreshCookie(refreshToken));
        response.sendRedirect(redirectUrl);
    }
}