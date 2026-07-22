package com.ssafy.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.filter.JWTFilter;
import com.ssafy.backend.filter.LoginFilter;
import com.ssafy.backend.handler.LoginSuccessHandler;
import com.ssafy.backend.handler.LogoutSuccessHandler;
import com.ssafy.backend.service.JwtService;

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

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AuthenticationConfiguration authenticationConfiguration;
    private final LoginSuccessHandler loginSuccessHandler;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    public SecurityConfig(
            AuthenticationConfiguration authenticationConfiguration,
            LoginSuccessHandler loginSuccessHandler,
            JwtService jwtService,
            ObjectMapper objectMapper
    ) {
        this.authenticationConfiguration = authenticationConfiguration;
        this.loginSuccessHandler = loginSuccessHandler;
        this.jwtService = jwtService;
        this.objectMapper = objectMapper;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        // 1. CSRF, FormLogin, BasicHttp 비활성화
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable);

        // 2. 세션 정책: STATELESS
        http
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // 3. 인가(URL별 권한) 설정 (현재 프로젝트 요구사항에 맞게 엔드포인트 수정)
        http
                .authorizeHttpRequests(auth -> auth
                        // 인증 없이 접근 허용
                        .requestMatchers("/api/v1/auth/**", "/jwt/exchange", "/jwt/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/user/exist", "/user").permitAll()
                        .requestMatchers("/error").permitAll()
                        // USER 권한 필요
                        .requestMatchers(HttpMethod.GET, "/user").hasRole("USER")
                        .requestMatchers(HttpMethod.PUT, "/user").hasRole("USER")
                        .requestMatchers(HttpMethod.DELETE, "/user").hasRole("USER")
                        .anyRequest().authenticated()
                );

        // 4. 인증 실패(401) 예외 처리
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

        // 5. 커스텀 필터 및 로그아웃 핸들러 추가
        http
                .addFilterBefore(new LoginFilter(authenticationManager(authenticationConfiguration), loginSuccessHandler), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new JWTFilter(jwtService), LogoutFilter.class);

        http
                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .addLogoutHandler(new LogoutSuccessHandler(jwtService))
                        .logoutSuccessHandler((request, response, authentication) -> {
                            response.setStatus(HttpServletResponse.SC_OK);
                        })
                );

        return http.build();
    }
}