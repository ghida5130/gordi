package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.RefreshToken;
import com.ssafy.backend.dto.auth.JWTResponseDTO;
import com.ssafy.backend.repository.RefreshRepository;
import com.ssafy.backend.util.CookieUtil;
import com.ssafy.backend.util.JWTUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
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

    @Value("${auth.refresh.reuse-grace-ms}")
    private long reuseGraceMs;

    // Refresh 토큰으로 Access/Refresh 토큰 재발급 (Refresh Token Rotation - RTR)
    @Transactional(noRollbackFor = ApiException.class)
    public JWTResponseDTO refreshRotate(HttpServletRequest request, HttpServletResponse response) {

        String refreshToken = CookieUtil.extractRefreshToken(request);
        if (refreshToken == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        // 1. 토큰 유효성 및 타입 검증
        if (!jwtUtil.isValid(refreshToken, false)) {
            throw tokenException(refreshToken);
        }

        // 3. 기존 토큰 정보 추출 및 신규 토큰 생성
        String email = jwtUtil.getEmail(refreshToken);
        String role = jwtUtil.getRole(refreshToken);

        LocalDateTime now = LocalDateTime.now();
        int rotated = refreshRepository.markRotated(refreshToken, now);

        if (rotated == 0) {
            return handleRotationConflict(refreshToken, email, role, now, response);
        }

        return issueTokens(email, role, refreshToken, response);
    }

    private JWTResponseDTO handleRotationConflict(
            String refreshToken, String email, String role,
            LocalDateTime now, HttpServletResponse response
    ) {
        RefreshToken existing = refreshRepository.findByRefresh(refreshToken).orElse(null);

        // 행 자체가 없음: 로그아웃·만료 정리로 폐기된 토큰 — 탈취 여부 판단 불가, 거부만 한다
        if (existing == null) {
            throw invalidToken("이미 사용된 refreshToken입니다.");
        }

        long elapsedMs = Duration.between(existing.getRotatedAt(), now).toMillis();

        // 회전 직후의 재제시는 멀티탭·네트워크 재시도일 가능성이 높다 — 정상 회전과 동일하게 응답
        if (elapsedMs <= reuseGraceMs) {
            if (existing.getSuccessor() != null) {
                String newAccessToken = jwtUtil.createJWT(email, role, true);
                response.addHeader("Set-Cookie", cookieUtil.createRefreshCookie(existing.getSuccessor()));
                return new JWTResponseDTO(newAccessToken);
            }
            // successor 기록이 없는 배포 이전 데이터 호환용 폴백
            return issueTokens(email, role, refreshToken, response);
        }

        // 회전된 지 오래된 토큰의 재제시 = 같은 토큰을 가진 주체가 둘 = 탈취 신호.
        // 공격자가 이미 회전받은 후속 토큰까지 무력화하기 위해 이 사용자의 토큰을 전량 폐기한다
        log.warn("[SECURITY] refresh token reuse detected: loginId={}, rotatedBefore={}ms, revoking all sessions",
                email, elapsedMs);
        refreshRepository.deleteByLoginId(email);
        throw invalidToken("이미 사용된 refreshToken입니다.");
    }

    private JWTResponseDTO issueTokens(String email, String role, String rotatedFrom, HttpServletResponse response) {
        String newAccessToken = jwtUtil.createJWT(email, role, true);
        String newRefreshToken = jwtUtil.createJWT(email, role, false);

        refreshRepository.save(
                RefreshToken.builder()
                        .loginId(email)
                        .refresh(newRefreshToken)
                        .build()
        );

        if (rotatedFrom != null) {
            refreshRepository.updateSuccessor(rotatedFrom, newRefreshToken);
        }

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

    // 특정 유저의 모든 Refresh 토큰 삭제
    // (로그아웃 / 탈퇴 시 사용)
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
