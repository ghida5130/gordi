package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.UserRequestDTO;
import com.ssafy.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class AuthService {

    // auth -> user 방향 의존만 허용 (user 의 저장소를 빌려 씀)
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // 회원가입
    @Transactional
    public Long signup(UserRequestDTO dto) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "이미 사용 중인 아이디입니다.",
                    Map.of("field", "email")
            );
        }

        User user = User.builder()
                .email(dto.getEmail())
                .password(passwordEncoder.encode(dto.getPassword()))  // 단방향 암호화
                .nickname(dto.getNickname())
                .build();

        return userRepository.save(user).getId();
    }

    // (선택) 이메일 중복 확인 - 기존 /user/exist 를 auth 로 옮길 때 사용
    @Transactional(readOnly = true)
    public boolean existsEmail(String email) {
        return userRepository.existsByEmail(email);
    }
}