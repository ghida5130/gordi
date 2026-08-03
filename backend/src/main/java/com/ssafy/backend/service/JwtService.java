package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.RefreshToken;
import com.ssafy.backend.dto.auth.JWTResponseDTO;
import com.ssafy.backend.repository.RefreshRepository;
import com.ssafy.backend.util.CookieUtil;
import com.ssafy.backend.util.JWTUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Map;

@Service
public class JwtService {

    private final RefreshRepository refreshRepository;
    private final JWTUtil jwtUtil;
    private final CookieUtil cookieUtil;

    public JwtService(RefreshRepository refreshRepository, JWTUtil jwtUtil, CookieUtil cookieUtil) {
        this.refreshRepository = refreshRepository;
        this.jwtUtil = jwtUtil;
        this.cookieUtil = cookieUtil;
    }

    // Refresh 토큰으로 Access/Refresh 토큰 재발급 (Refresh Token Rotation - RTR)
    @Transactional
    public JWTResponseDTO refreshRotate(HttpServletRequest request, HttpServletResponse response) {

        String refreshToken = CookieUtil.extractRefreshToken(request);
        if (refreshToken == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        // 1. 토큰 유효성 및 타입 검증
        if (!jwtUtil.isValid(refreshToken, false)) {
            throw tokenException(refreshToken);
        }

        // 2. DB 존재 여부 확인 (이미 사용되거나 폐기된 토큰 방지)
        if (!existsRefresh(refreshToken)) {
            throw invalidToken("이미 사용된 refreshToken입니다.");
        }

        // 3. 기존 토큰 정보 추출 및 신규 토큰 생성
        String email = jwtUtil.getEmail(refreshToken);
        String role = jwtUtil.getRole(refreshToken);

        String newAccessToken = jwtUtil.createJWT(email, role, true);
        String newRefreshToken = jwtUtil.createJWT(email, role, false);

        // 4. 기존 Refresh 토큰 삭제 및 신규 Refresh 토큰 DB 저장
        removeRefresh(refreshToken);
        refreshRepository.save(
                RefreshToken.builder()
                        .loginId(email)
                        .refresh(newRefreshToken)
                        .build()
        );

        response.addHeader("Set-Cookie", cookieUtil.createRefreshCookie(newRefreshToken));

        return new JWTResponseDTO(newAccessToken);
    }

    // JWT Refresh 토큰 저장
    @Transactional
    public void addRefresh(String email, String refreshToken) {
        RefreshToken entity = RefreshToken.builder()
                .loginId(email)
                .refresh(refreshToken)
                .build();

        refreshRepository.save(entity);
    }

    // JWT Refresh 토큰 존재 확인
    @Transactional(readOnly = true)
    public Boolean existsRefresh(String refreshToken) {
        return refreshRepository.existsByRefresh(refreshToken);
    }

    // JWT Refresh 토큰 단건 삭제
    @Transactional
    public void removeRefresh(String refreshToken) {
        refreshRepository.deleteByRefresh(refreshToken);
    }

    // 특정 유저의 모든 Refresh 토큰 삭제 (로그아웃 / 탈퇴 시 사용)
    @Transactional
    public void removeRefreshUser(String email) {
        refreshRepository.deleteByLoginId(email);
    }

    private ApiException tokenException(String token) {
        if (jwtUtil.isExpired(token)) {
            return new ApiException(ErrorCode.TOKEN_EXPIRED);
        }
        return invalidToken(ErrorCode.INVALID_TOKEN.getMessage());
    }

    private ApiException invalidToken(String message) {
        return new ApiException(
                ErrorCode.INVALID_TOKEN,
                message,
                Map.of("field", "refreshToken")
        );
    }
}
