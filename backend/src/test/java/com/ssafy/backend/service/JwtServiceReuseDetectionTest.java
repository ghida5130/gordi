package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.domain.RefreshToken;
import com.ssafy.backend.dto.auth.JWTResponseDTO;
import com.ssafy.backend.repository.RefreshRepository;
import com.ssafy.backend.util.CookieUtil;
import com.ssafy.backend.util.JWTUtil;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// 주의: 이 테스트는 의도적으로 @Transactional을 붙이지 않는다.
// 재사용 감지의 "폐기(delete) 후 예외를 던져도 폐기는 커밋되어야 한다"(noRollbackFor)는
// 트랜잭션 경계 밖에서만 검증 가능하다 — 테스트 트랜잭션으로 감싸면 롤백 누락 버그가 가려진다.
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:jwt_reuse_detection;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "jwt.secret=jwt-reuse-detection-test-secret-key-32bytes",
        "jwt.access-token-expiration=3600000",
        "jwt.refresh-token-expiration=604800000",
        "spring.security.oauth2.client.registration.kakao.client-id=test-client",
        "spring.security.oauth2.client.registration.kakao.client-secret=test-secret",
        "room.expiration-cleanup.enabled=false",
        "gordi.try-on.reconcile.enabled=false",
        "auth.refresh.reuse-grace-ms=30000"
})
class JwtServiceReuseDetectionTest {

    @Autowired
    private JwtService jwtService;
    @Autowired
    private RefreshRepository refreshRepository;
    @Autowired
    private JWTUtil jwtUtil;

    private static final String EMAIL = "reuse-test@test.com";
    private static final String ROLE = "ROLE_USER";

    @BeforeEach
    void cleanUp() {
        refreshRepository.deleteAll();
    }

    private String issueAndStore() {
        String token = jwtUtil.createJWT(EMAIL, ROLE, false);
        jwtService.addRefresh(EMAIL, token);
        return token;
    }

    private JWTResponseDTO rotate(String refreshToken) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(CookieUtil.REFRESH_COOKIE_NAME, refreshToken));
        return jwtService.refreshRotate(request, new MockHttpServletResponse());
    }

    private List<RefreshToken> userTokens() {
        return refreshRepository.findAll().stream()
                .filter(t -> EMAIL.equals(t.getLoginId()))
                .toList();
    }

    private MockHttpServletResponse rotateWithResponse(String refreshToken) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(CookieUtil.REFRESH_COOKIE_NAME, refreshToken));
        MockHttpServletResponse response = new MockHttpServletResponse();
        jwtService.refreshRotate(request, response);
        return response;
    }

    private String extractRefreshCookie(MockHttpServletResponse response) {
        String setCookie = response.getHeader("Set-Cookie");
        return setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));
    }

    @Test
    @DisplayName("정상 회전: 기존 토큰에 rotated_at이 찍히고 새 토큰이 저장된다")
    void rotate_marksOldAndSavesNew() {
        String oldToken = issueAndStore();

        JWTResponseDTO result = rotate(oldToken);

        assertThat(result.accessToken()).isNotBlank();
        List<RefreshToken> tokens = userTokens();
        assertThat(tokens).hasSize(2);
        assertThat(tokens.stream().filter(t -> t.getRotatedAt() == null)).hasSize(1);
        assertThat(tokens.stream().filter(t -> t.getRotatedAt() != null)).hasSize(1);
    }

    @Test
    @DisplayName("grace 이내 재제시: 새 토큰을 만들지 않고 최초 회전 결과를 그대로 재반환한다(멱등)")
    void reuseWithinGrace_isTolerated() {
        String oldToken = issueAndStore();

        String firstIssued = extractRefreshCookie(rotateWithResponse(oldToken));
        String secondReuse = extractRefreshCookie(rotateWithResponse(oldToken));
        String thirdReuse = extractRefreshCookie(rotateWithResponse(oldToken));

        // 몇 번을 재제시해도 항상 최초 회전 때 발급한 그 토큰이 돌아온다
        assertThat(secondReuse).isEqualTo(firstIssued);
        assertThat(thirdReuse).isEqualTo(firstIssued);

        // 행이 증식하지 않는다: old(회전됨) + 후속 토큰, 딱 2개
        assertThat(userTokens()).hasSize(2);
    }

    @Test
    @DisplayName("grace 초과 재사용(탈취 신호): 401을 던지되 해당 유저 토큰은 전량 폐기되어 남는다")
    void reuseBeyondGrace_revokesAllUserTokens() {
        String oldToken = issueAndStore();
        rotate(oldToken); // 정상 회전 → 공격자가 이 시점에 후속 토큰을 확보했다고 가정

        // 회전 시각을 60초 전으로 조작해 "grace가 지난 뒤의 재사용"을 재현
        RefreshToken rotatedRow = userTokens().stream()
                .filter(t -> t.getRotatedAt() != null)
                .findFirst().orElseThrow();
        rotatedRow.setRotatedAt(LocalDateTime.now().minusSeconds(60));
        refreshRepository.saveAndFlush(rotatedRow);

        assertThatThrownBy(() -> rotate(oldToken))
                .isInstanceOf(ApiException.class);

        // 핵심: 예외를 던졌는데도 폐기가 롤백되지 않고 커밋되었는가 (noRollbackFor 검증)
        assertThat(userTokens()).isEmpty();
    }

    @Test
    @DisplayName("DB에 없는 토큰(로그아웃 등으로 정리됨): 거부만 하고 다른 세션은 폐기하지 않는다")
    void unknownToken_rejectsWithoutRevoking() throws InterruptedException {
        String storedToken = issueAndStore();
        String neverStoredToken = jwtUtil.createJWT(EMAIL, ROLE, false);

        assertThatThrownBy(() -> rotate(neverStoredToken))
                .isInstanceOf(ApiException.class);

        // 기존 세션은 무사해야 한다
        assertThat(userTokens()).hasSize(1);
        assertThat(userTokens().get(0).getRefresh()).isEqualTo(storedToken);
    }
}