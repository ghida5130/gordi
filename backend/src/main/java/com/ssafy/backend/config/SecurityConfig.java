package com.ssafy.backend.config;

import com.ssafy.backend.filter.JWTFilter;
import com.ssafy.backend.filter.LoginFilter;
import com.ssafy.backend.handler.LoginSuccessHandler;
import com.ssafy.backend.handler.LogoutSuccessHandler;
import com.ssafy.backend.service.JwtService;
import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.http.HttpServletResponse;
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

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AuthenticationConfiguration authenticationConfiguration;
    private final LoginSuccessHandler loginSuccessHandler; // 단일 주입으로 정리
    private final JwtService jwtService;
    private final JWTUtil jwtUtil;
    private final ObjectMapper objectMapper = new ObjectMapper(); // ObjectMapper 직접 생성 또는 주입

    public SecurityConfig(
            AuthenticationConfiguration authenticationConfiguration,
            LoginSuccessHandler loginSuccessHandler,
            JwtService jwtService,
            JWTUtil jwtUtil
    ) {
        this.authenticationConfiguration = authenticationConfiguration;
        this.loginSuccessHandler = loginSuccessHandler;
        this.jwtService = jwtService;
        this.jwtUtil = jwtUtil;
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
                        .requestMatchers("/jwt/exchange", "/jwt/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/user/exist", "/user").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/user").hasRole("USER")
                        .requestMatchers(HttpMethod.PUT, "/user").hasRole("USER")
                        .requestMatchers(HttpMethod.DELETE, "/user").hasRole("USER")
                        .anyRequest().authenticated());

        // 예외 처리 (401 Unauthorized)
        http
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setContentType("application/json;charset=UTF-8");
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            Map<String, String> errorResponse = new HashMap<>();
                            errorResponse.put("message", "인증 정보가 유효하지 않습니다");
                            String jsonResult = objectMapper.writeValueAsString(errorResponse);
                            response.getWriter().write(jsonResult);
                        })
                );

        // 커스텀 로그인 필터 등록
        http.addFilterBefore(
                new LoginFilter(authenticationManager(authenticationConfiguration), loginSuccessHandler),
                UsernamePasswordAuthenticationFilter.class
        );

        // JWT 인가 필터 등록 (JWTUtil static 접근이므로 기본 생성자로 생성)
        http.addFilterBefore(new JWTFilter(jwtUtil), LogoutFilter.class);

        // 로그아웃 핸들러 등록
        http.logout(logout -> logout
                .logoutUrl("/logout")
                .addLogoutHandler(new LogoutSuccessHandler(jwtService, jwtUtil))
                .logoutSuccessHandler((request, response, authentication) -> {
                    response.setStatus(HttpServletResponse.SC_OK);
                })
        );

        return http.build();
    }
}