package com.ssafy.backend.config;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.filter.JWTFilter;
import com.ssafy.backend.filter.LoginFilter;
import com.ssafy.backend.handler.LoginSuccessHandler;
import com.ssafy.backend.handler.LogoutSuccessHandler;
import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.JWTUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.logout.LogoutFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AuthenticationConfiguration authenticationConfiguration;
    private final LoginSuccessHandler loginSuccessHandler; // 단일 주입으로 정리
    private final JwtService jwtService;
    private final JWTUtil jwtUtil;
    private final ObjectMapper objectMapper;
    private final ApiErrorResponseWriter errorResponseWriter;

    public SecurityConfig(
            AuthenticationConfiguration authenticationConfiguration,
            LoginSuccessHandler loginSuccessHandler,
            JwtService jwtService,
            JWTUtil jwtUtil,
            ObjectMapper objectMapper,
            ApiErrorResponseWriter errorResponseWriter
    ) {
        this.authenticationConfiguration = authenticationConfiguration;
        this.loginSuccessHandler = loginSuccessHandler;
        this.jwtService = jwtService;
        this.jwtUtil = jwtUtil;
        this.objectMapper = objectMapper;
        this.errorResponseWriter = errorResponseWriter;
    }

    // 비밀번호 단방향 암호화용 빈
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
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
                        .requestMatchers("/api/v1/auth/refresh", "/api/v1/auth/exchange").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/signup").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/v1/users/**").hasRole("USER")
                        .requestMatchers(
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/v3/api-docs.yaml"
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

        return http.build();
    }
}
