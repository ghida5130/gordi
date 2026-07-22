package com.ssafy.backend.filter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.util.StreamUtils;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AbstractAuthenticationProcessingFilter;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

public class LoginFilter extends AbstractAuthenticationProcessingFilter {

    // 클라이언트 JSON 데이터에서 아이디를 꺼내올 Key를 의미
    public static final String SPRING_SECURITY_FORM_USERNAME_KEY = "loginId";
    public static final String SPRING_SECURITY_FORM_PASSWORD_KEY = "password";

    private static final RequestMatcher DEFAULT_ANT_PATH_REQUEST_MATCHER = PathPatternRequestMatcher.withDefaults()
            .matcher(HttpMethod.POST, "/login");

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final String usernameParameter = SPRING_SECURITY_FORM_USERNAME_KEY;
    private final String passwordParameter = SPRING_SECURITY_FORM_PASSWORD_KEY;
    private final AuthenticationSuccessHandler authenticationSuccessHandler;

    // 자체 로그인 필터에서 성공 핸들러 등록
    public LoginFilter(AuthenticationManager authenticationManager, AuthenticationSuccessHandler authenticationSuccessHandler) {
        super(DEFAULT_ANT_PATH_REQUEST_MATCHER, authenticationManager);
        this.authenticationSuccessHandler = authenticationSuccessHandler;
    }

    @Override
    public Authentication attemptAuthentication(HttpServletRequest request, HttpServletResponse response)
            throws AuthenticationException {

        if (!request.getMethod().equals("POST")) {
            throw new AuthenticationServiceException("Authentication method not supported: " + request.getMethod());
        }

        Map<String, String> loginMap;

        try {
            ServletInputStream inputStream = request.getInputStream();
            String messageBody = StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);

            loginMap = OBJECT_MAPPER.readValue(messageBody, new TypeReference<>() {});
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        String loginId = loginMap.get(usernameParameter);
        loginId = (loginId != null) ? loginId.trim() : "";

        String password = loginMap.get(passwordParameter);
        password = (password != null) ? password : "";

        UsernamePasswordAuthenticationToken authRequest = UsernamePasswordAuthenticationToken.unauthenticated(loginId, password);
        setDetails(request, authRequest);

        return this.getAuthenticationManager().authenticate(authRequest); // Authentication Manager에게 전달
    }

    protected void setDetails(HttpServletRequest request, UsernamePasswordAuthenticationToken authRequest) {
        authRequest.setDetails(this.authenticationDetailsSource.buildDetails(request));
    }

    @Override
    protected void successfulAuthentication(HttpServletRequest request, HttpServletResponse response, FilterChain chain,
                                            Authentication authResult) throws IOException, ServletException {
        authenticationSuccessHandler.onAuthenticationSuccess(request, response, authResult); // 로그인 성공하면 성공로그인핸들러 실행하도록 설정
    }
}