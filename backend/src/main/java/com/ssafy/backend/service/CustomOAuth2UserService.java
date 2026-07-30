package com.ssafy.backend.service;

import com.ssafy.backend.domain.User;
import com.ssafy.backend.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private static final String PROVIDER_KAKAO = "KAKAO";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public CustomOAuth2UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);
        Map<String, Object> attributes = oAuth2User.getAttributes();

        // 카카오 응답 파싱
        String providerId = String.valueOf(attributes.get("id"));

        @SuppressWarnings("unchecked")
        Map<String, Object> kakaoAccount =
                (Map<String, Object>) attributes.getOrDefault("kakao_account", Map.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> profile =
                (Map<String, Object>) kakaoAccount.getOrDefault("profile", Map.of());

        String email = (String) kakaoAccount.get("email");
        // 이메일 동의 거부 시 대체 이메일 생성 (JWT subject가 email이라 null 불가)
        String resolvedEmail = (email != null) ? email : "kakao_" + providerId + "@social.local";
        String nickname = (String) profile.getOrDefault("nickname", "카카오유저");

        // 기존 소셜 유저 조회 → 없으면 이메일 기준 자동 연동 → 그것도 없으면 신규 가입
        User user = userRepository.findByProviderAndProviderId(PROVIDER_KAKAO, providerId)
                .orElseGet(() -> userRepository.findByEmail(resolvedEmail)
                        .map(existing -> {
                            // 같은 이메일의 기존(로컬) 계정에 카카오 연동
                            existing.setProvider(PROVIDER_KAKAO);
                            existing.setProviderId(providerId);
                            return existing;
                        })
                        .orElseGet(() -> userRepository.save(
                                User.builder()
                                        .email(resolvedEmail)
                                        // password NOT NULL 제약 대응용 더미 값 (로그인에 사용 불가)
                                        .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                                        .nickname(nickname)
                                        .provider(PROVIDER_KAKAO)
                                        .providerId(providerId)
                                        .build()
                        )));

        // SuccessHandler에서 authentication.getName()으로 email을 꺼낼 수 있도록
        // name attribute를 email로 지정
        Map<String, Object> enriched = new HashMap<>(attributes);
        enriched.put("email", user.getEmail());

        return new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("ROLE_USER")),
                enriched,
                "email"
        );
    }
}