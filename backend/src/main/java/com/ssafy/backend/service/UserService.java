package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.UserRequestDTO;
import com.ssafy.backend.dto.UserResponseDTO;
import com.ssafy.backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    // 자체 로그인 회원 가입 (존재 여부 검증)
    @Transactional(readOnly = true)
    public Boolean existUser(UserRequestDTO dto) {
        return userRepository.existsByLoginId(dto.getLoginId());
    }

    // 자체 로그인 회원 가입
    @Transactional
    public Long addUser(UserRequestDTO dto) {
        if (userRepository.existsByLoginId(dto.getLoginId())) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "이미 사용 중인 아이디입니다.",
                    Map.of("field", "loginId")
            );
        }

        User user = User.builder()
                .loginId(dto.getLoginId())
                .password(passwordEncoder.encode(dto.getPassword()))
                .nickname(dto.getNickname())
                .build();

        return userRepository.save(user).getUserId();
    }

    // Spring Security 사용자 인증 정보 로드
    @Transactional(readOnly = true)
    @Override
    public UserDetails loadUserByUsername(String loginId) throws UsernameNotFoundException {
        User user = userRepository.findByLoginId(loginId)
                .orElseThrow(() -> new UsernameNotFoundException("해당 아이디의 유저를 찾을 수 없습니다: " + loginId));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getLoginId())
                .password(user.getPassword())
                .roles("USER") // ROLE_USER 부여
                .build();
    }

    // 자체 로그인 회원 정보 수정
    @Transactional
    public Long updateUser(UserRequestDTO dto) throws AccessDeniedException {
        String sessionLoginId = SecurityContextHolder.getContext().getAuthentication().getName();

        if (!sessionLoginId.equals(dto.getLoginId())) {
            throw new AccessDeniedException("본인 계정만 수정 가능합니다.");
        }

        User user = userRepository.findByLoginId(dto.getLoginId())
                .orElseThrow(() -> new UsernameNotFoundException("해당 유저를 찾을 수 없습니다: " + dto.getLoginId()));

        user.updateUser(dto);

        return userRepository.save(user).getUserId();
    }

    // 자체 유저 정보 조회
    @Transactional(readOnly = true)
    public UserResponseDTO readUser() {
        String loginId = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByLoginId(loginId)
                .orElseThrow(() -> new UsernameNotFoundException("해당 유저를 찾을 수 없습니다: " + loginId));

        return new UserResponseDTO(loginId, user.getNickname());
    }

    // 자체 로그인 회원 탈퇴
    @Transactional
    public void deleteUser(UserRequestDTO dto) throws AccessDeniedException {
        SecurityContext context = SecurityContextHolder.getContext();
        String sessionLoginId = context.getAuthentication().getName();

        boolean isOwner = sessionLoginId.equals(dto.getLoginId());

        if (!isOwner) {
            throw new AccessDeniedException("본인만 삭제할 수 있습니다.");
        }

        // DB에서 유저 삭제
        userRepository.deleteByLoginId(dto.getLoginId());

        // 해당 유저의 모든 리프레시 토큰 폐기
        jwtService.removeRefreshUser(dto.getLoginId());
    }
}
