package com.ssafy.backend.config;

import com.ssafy.backend.common.error.ApiErrorResponseWriter;
import com.ssafy.backend.filter.LoginRateLimitFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RateLimitConfig {

    @Bean
    public FilterRegistrationBean<LoginRateLimitFilter> loginRateLimitFilter(
            ApiErrorResponseWriter errorResponseWriter) {

        FilterRegistrationBean<LoginRateLimitFilter> registration =
                new FilterRegistrationBean<>(new LoginRateLimitFilter(errorResponseWriter));

        registration.addUrlPatterns("/api/v1/auth/login"); // 이 경로에만 적용
        registration.setOrder(-101); // 시큐리티 체인(-100)보다 먼저
        return registration;
    }
}