package com.ssafy.backend.util;

import com.ssafy.backend.common.time.AppZone;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LivekitTokenProviderTest {

    private static final String API_KEY = "devkey";
    private static final String API_SECRET =
            "livekit-test-secret-key-with-at-least-32-bytes";
    private static final long TEN_MINUTES = 600_000L;

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(API_SECRET.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    @Test
    void livekit_토큰_클레임_테스트() {
        LivekitTokenProvider provider = new LivekitTokenProvider(API_KEY, API_SECRET, TEN_MINUTES);

        LivekitTokenProvider.IssuedToken issued = provider.createParticipantToken(
                42L,
                "친구1",
                "gordi-room-31",
                LocalDateTime.now(AppZone.KST).plusHours(2)
        );

        Claims claims = parse(issued.token());
        assertThat(claims.getIssuer()).isEqualTo(API_KEY);
        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get("name", String.class)).isEqualTo("친구1");

        @SuppressWarnings("unchecked")
        Map<String, Object> video = claims.get("video", Map.class);
        assertThat(video.get("roomJoin")).isEqualTo(true);
        assertThat(video.get("room")).isEqualTo("gordi-room-31");
        assertThat(video.get("canPublish")).isEqualTo(true);
        assertThat(video.get("canSubscribe")).isEqualTo(true);
        assertThat(video.get("canPublishData")).isEqualTo(false);
        assertThat(video.get("canPublishSources")).isEqualTo(List.of("microphone"));
    }

    @Test
    void 토큰_만료는_방_만료를_넘지_않는다() {
        LivekitTokenProvider provider = new LivekitTokenProvider(API_KEY, API_SECRET, TEN_MINUTES);
        LocalDateTime roomExpiresAt = LocalDateTime.now(AppZone.KST).plusMinutes(3);

        LivekitTokenProvider.IssuedToken issued = provider.createParticipantToken(
                42L, "친구1", "gordi-room-31", roomExpiresAt);

        Instant roomExpiry = roomExpiresAt.atZone(AppZone.KST).toInstant();
        assertThat(issued.expiresAt()).isBeforeOrEqualTo(roomExpiry);
        assertThat(parse(issued.token()).getExpiration().toInstant())
                .isBeforeOrEqualTo(roomExpiry.plusSeconds(1)); // Date 초 단위 절삭 허용
    }

    @Test
    void 방_만료가_멀면_TTL이_적용된다() {
        LivekitTokenProvider provider = new LivekitTokenProvider(API_KEY, API_SECRET, TEN_MINUTES);

        LivekitTokenProvider.IssuedToken issued = provider.createParticipantToken(
                42L, "친구1", "gordi-room-31",
                LocalDateTime.now(AppZone.KST).plusHours(2));

        assertThat(issued.expiresAt())
                .isBeforeOrEqualTo(Instant.now().plusMillis(TEN_MINUTES + 1_000));
    }
}
