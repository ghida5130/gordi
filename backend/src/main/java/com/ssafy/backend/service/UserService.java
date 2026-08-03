package com.ssafy.backend.service;

import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.users.UserRequestDTO;
import com.ssafy.backend.dto.users.UserResponseDTO;
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
        return userRepository.existsByEmail(dto.getEmail());
    }

    // Spring Security 사용자 인증 정보 로드
    @Transactional(readOnly = true)
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("해당 아이디의 유저를 찾을 수 없습니다: " + email));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .roles("USER") // ROLE_USER 부여
                .build();
    }

    // 자체 로그인 회원 정보 수정
    @Transactional
    public Long updateUser(UserRequestDTO dto) throws AccessDeniedException {
        String sessionEmail = SecurityContextHolder.getContext().getAuthentication().getName();

        if (!sessionEmail.equals(dto.getEmail())) {
            throw new AccessDeniedException("본인 계정만 수정 가능합니다.");
        }

        User user = userRepository.findByEmail(dto.getEmail())
                .orElseThrow(() -> new UsernameNotFoundException("해당 유저를 찾을 수 없습니다: " + dto.getEmail()));

        user.updateUser(dto);

        return userRepository.save(user).getId();
    }

    // 닉네임 수정
    @Transactional
    public void updateNickname(String nickname) {
        String email = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new UsernameNotFoundException(
                                "사용자를 찾을 수 없습니다: " + email
                        )
                );

        user.updateNickname(nickname);
    }

    // 자체 유저 정보 조회
    @Transactional(readOnly = true)
    public UserResponseDTO readUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("해당 유저를 찾을 수 없습니다: " + email));

        return UserResponseDTO.from(user);
    }

    // 자체 로그인 회원 탈퇴
    @Transactional
    public void deleteUser(UserRequestDTO dto) throws AccessDeniedException {
        SecurityContext context = SecurityContextHolder.getContext();
        String sessionEmail = context.getAuthentication().getName();

        boolean isOwner = sessionEmail.equals(dto.getEmail());

        if (!isOwner) {
            throw new AccessDeniedException("본인만 삭제할 수 있습니다.");
        }

        // DB에서 유저 삭제
        userRepository.deleteByEmail(dto.getEmail());

        // 해당 유저의 모든 리프레시 토큰 폐기
        jwtService.removeRefreshUser(dto.getEmail());
    }
}
