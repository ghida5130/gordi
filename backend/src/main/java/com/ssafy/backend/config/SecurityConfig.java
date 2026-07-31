package com.ssafy.backend.config;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.filter.InternalTokenFilter;
import com.ssafy.backend.filter.JWTFilter;
import com.ssafy.backend.filter.LoginFilter;
import com.ssafy.backend.handler.LoginSuccessHandler;
import com.ssafy.backend.handler.LogoutSuccessHandler;
import com.ssafy.backend.handler.OAuth2SuccessHandler;
import com.ssafy.backend.service.CustomOAuth2UserService;
import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.JWTUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.logout.LogoutFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AuthenticationConfiguration authenticationConfiguration;
    private final LoginSuccessHandler loginSuccessHandler; // 단일 주입으로 정리
    private final JwtService jwtService;
    private final JWTUtil jwtUtil;
    private final ApiErrorResponseWriter errorResponseWriter;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final InternalTokenFilter internalTokenFilter;

    @Value("${oauth2.failure-redirect-url}")
    private String oauthFailureRedirectUrl;

    public SecurityConfig(
            AuthenticationConfiguration authenticationConfiguration,
            LoginSuccessHandler loginSuccessHandler,
            JwtService jwtService,
            JWTUtil jwtUtil,
            ApiErrorResponseWriter errorResponseWriter,
            CustomOAuth2UserService customOAuth2UserService,
            OAuth2SuccessHandler oAuth2SuccessHandler,
            InternalTokenFilter internalTokenFilter
    ) {
        this.authenticationConfiguration = authenticationConfiguration;
        this.loginSuccessHandler = loginSuccessHandler;
        this.jwtService = jwtService;
        this.jwtUtil = jwtUtil;
        this.errorResponseWriter = errorResponseWriter;
        this.customOAuth2UserService = customOAuth2UserService;
        this.oAuth2SuccessHandler = oAuth2SuccessHandler;
        this.internalTokenFilter = internalTokenFilter;
    }

    // 로그인 필터 AuthenticationManager
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        // CSRF, 기본 폼로그인, Basic 인증 비활성화
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable);

        // 세션 필터 설정 (STATELESS)
        http
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // 인가 설정
        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/refresh").permitAll()
                        .requestMatchers("/api/v1/oauth2/**", "/api/v1/login/oauth2/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/signup").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/rooms/*/join").permitAll()
                        .requestMatchers("/error").permitAll()
                        // WebSocket 핸드셰이크는 열어두고, 인증은 STOMP CONNECT 인터셉터에서 수행
                        .requestMatchers("/ws/v1/**").permitAll()
                        // 내부 호출(FastAPI 콜백)은 열어두고, 인증은 InternalTokenFilter 에서 수행
                        .requestMatchers("/internal/**").permitAll()
                        .requestMatchers("/api/v1/users/**").hasRole("USER")
                        .requestMatchers("/api/v1/recommendation-options").hasRole("USER")
                        .requestMatchers("/api/v1/recommendations/**").hasRole("USER")
                        .requestMatchers(
                                "/api/swagger-ui.html",
                                "/api/swagger-ui/**",
                                "/api/v3/api-docs/**",
                                "/api/v3/api-docs.yaml"
                        ).permitAll()
                        .anyRequest().authenticated());

        // 예외 처리 (401 Unauthorized)
        http
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((request, response, authException) -> {
                            errorResponseWriter.write(request, response, ErrorCode.UNAUTHORIZED);
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                errorResponseWriter.write(request, response, ErrorCode.FORBIDDEN)
                        )
                );

        // 커스텀 로그인 필터 등록
        http.addFilterBefore(
                new LoginFilter(
                        authenticationManager(authenticationConfiguration),
                        loginSuccessHandler,
                        errorResponseWriter
                ),
                UsernamePasswordAuthenticationFilter.class
        );

        // JWT 인가 필터 등록 (JWTUtil static 접근이므로 기본 생성자로 생성)
        http.addFilterBefore(new JWTFilter(jwtUtil, errorResponseWriter), LogoutFilter.class);

        // 내부 호출 서비스 토큰 검증 (/internal/** 만 검사, 그 외 경로는 스스로 건너뜀)
        http.addFilterBefore(internalTokenFilter, LogoutFilter.class);

        // 로그아웃 핸들러 등록
        http.logout(logout -> logout
                .logoutUrl("/api/v1/auth/logout")
                .addLogoutHandler(new LogoutSuccessHandler(
                        jwtService,
                        jwtUtil
                ))
                .logoutSuccessHandler((request, response, authentication) -> {
                    if (!response.isCommitted()) {
                        response.setStatus(204);
                    }
                })
        );

        // OAuth2 로그인 (카카오)
        http.oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(a -> a.baseUri("/api/v1/oauth2/authorization"))
                .redirectionEndpoint(r -> r.baseUri("/api/v1/login/oauth2/code/*"))
                .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                .successHandler(oAuth2SuccessHandler)
                .failureHandler((request, response, exception) ->
                        response.sendRedirect(oauthFailureRedirectUrl))
        );

        return http.build();
    }
}
