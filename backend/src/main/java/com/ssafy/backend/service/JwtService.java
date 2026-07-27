package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.dto.JWTResponseDTO;
import com.ssafy.backend.dto.RefreshRequestDTO;
import com.ssafy.backend.util.RefreshEntity;
import com.ssafy.backend.repository.RefreshRepository;
import com.ssafy.backend.util.JWTUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Map;

@Service
public class JwtService {

    private final RefreshRepository refreshRepository;
    private final JWTUtil jwtUtil;

    public JwtService(RefreshRepository refreshRepository, JWTUtil jwtUtil) {
        this.refreshRepository = refreshRepository;
        this.jwtUtil = jwtUtil;
    }

    // 쿠키에 담긴 Refresh 토큰을 읽어 Header/Body 응답용 토큰으로 전환 (웹 ➔ 모바일/기타 전환 시 활용)
    @Transactional
    public JWTResponseDTO cookie2Header(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            throw invalidToken("Refresh Token 쿠키가 없습니다.");
        }

        String refreshToken = null;
        for (Cookie cookie : cookies) {
            if ("refreshToken".equals(cookie.getName())) {
                refreshToken = cookie.getValue();
                break;
            }
        }

        if (refreshToken == null) {
            throw invalidToken("Refresh Token 쿠키가 없습니다.");
        }

        // 1. 토큰 유효성 검증 (인스턴스 메서드 호출)
        Boolean isValid = jwtUtil.isValid(refreshToken, false);
        if (!isValid) {
            throw tokenException(refreshToken);
        }

        // 2. 토큰 정보 추출 및 신규 토큰 발급
        String loginId = jwtUtil.getLoginId(refreshToken);
        String role = jwtUtil.getRole(refreshToken);

        String newAccessToken = jwtUtil.createJWT(loginId, role, true);
        String newRefreshToken = jwtUtil.createJWT(loginId, role, false);

        RefreshEntity newRefreshEntity = RefreshEntity.builder()
                .loginId(loginId)
                .refresh(newRefreshToken)
                .build();

        // 3. 기존 토큰 삭제 후 DB 동기화 및 저장
        removeRefresh(refreshToken);
        refreshRepository.flush();
        refreshRepository.save(newRefreshEntity);

        // 4. 기존 쿠키 만료 처리 (쿠키 파기)
        Cookie refreshCookie = new Cookie("refreshToken", null);
        refreshCookie.setHttpOnly(true);
        refreshCookie.setSecure(false);
        refreshCookie.setPath("/");
        refreshCookie.setMaxAge(0); // 0으로 설정하여 쿠키 삭제 유도
        response.addCookie(refreshCookie);

        return new JWTResponseDTO(newAccessToken, newRefreshToken);
    }

    // Refresh 토큰으로 Access/Refresh 토큰 재발급 (Refresh Token Rotation - RTR)
    @Transactional
    public JWTResponseDTO refreshRotate(RefreshRequestDTO dto) {

        String refreshToken = dto.getRefreshToken();

        // 1. 토큰 유효성 및 타입 검증
        Boolean isValid = jwtUtil.isValid(refreshToken, false);
        if (!isValid) {
            throw tokenException(refreshToken);
        }

        // 2. DB 존재 여부 확인 (이미 사용되거나 폐기된 토큰 방지)
        if (!existsRefresh(refreshToken)) {
            throw invalidToken("폐기되었거나 존재하지 않는 Refresh Token입니다.");
        }

        // 3. 기존 토큰 정보 추출 및 신규 토큰 생성
        String loginId = jwtUtil.getLoginId(refreshToken);
        String role = jwtUtil.getRole(refreshToken);

        String newAccessToken = jwtUtil.createJWT(loginId, role, true);
        String newRefreshToken = jwtUtil.createJWT(loginId, role, false);

        // 4. 기존 Refresh 토큰 삭제 및 신규 Refresh 토큰 DB 저장
        removeRefresh(refreshToken);

        RefreshEntity newRefreshEntity = RefreshEntity.builder()
                .loginId(loginId)
                .refresh(newRefreshToken)
                .build();

        refreshRepository.save(newRefreshEntity);

        return new JWTResponseDTO(newAccessToken, newRefreshToken);
    }

    // JWT Refresh 토큰 저장
    @Transactional
    public void addRefresh(String loginId, String refreshToken) {
        RefreshEntity entity = RefreshEntity.builder()
                .loginId(loginId)
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
    public void removeRefreshUser(String loginId) {
        refreshRepository.deleteByLoginId(loginId);
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
