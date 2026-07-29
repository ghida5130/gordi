package com.ssafy.backend.util;

import com.ssafy.backend.common.time.AppZone;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class RoomTokenProviderTest {

    private static final String SECRET =
            "room-token-test-secret-key-with-at-least-32-bytes";

    @Test
    void roomTokenProvider_테스트() {
        RoomTokenProvider provider = new RoomTokenProvider(SECRET, 3_600_000L);

        String token = provider.createRoomToken(
                42L,
                31L,
                "친구1",
                "PARTICIPANTS",
                LocalDateTime.now(AppZone.KST).plusHours(2)
        );

        RoomTokenProvider.RoomClaims claims = provider.parse(token);

        assertThat(claims.participantId()).isEqualTo(42L);
        assertThat(claims.roomId()).isEqualTo(31L);
        assertThat(claims.nickname()).isEqualTo("친구1");
        assertThat(claims.role()).isEqualTo("PARTICIPANTS");
    }
}
