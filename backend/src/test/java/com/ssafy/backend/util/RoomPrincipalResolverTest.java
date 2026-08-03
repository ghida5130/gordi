package com.ssafy.backend.util;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.websocket.RoomPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RoomPrincipalResolverTest {

    @Test
    void roomToken_인증객체이면_RoomPrincipal을_반환한다() {
        RoomPrincipal principal = new RoomPrincipal(
                42L,
                31L,
                "친구1",
                "PARTICIPANTS"
        );
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of()
        );

        RoomPrincipal result = RoomPrincipalResolver.require(authentication);

        assertThat(result).isSameAs(principal);
    }

    @Test
    void 인증객체가_없으면_UNAUTHORIZED를_던진다() {
        assertThatThrownBy(() -> RoomPrincipalResolver.require(null))
                .isInstanceOfSatisfying(ApiException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    void accessToken_인증객체이면_FORBIDDEN을_던진다() {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                "user@example.com",
                null,
                List.of()
        );

        assertThatThrownBy(() -> RoomPrincipalResolver.require(authentication))
                .isInstanceOfSatisfying(ApiException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }
}
