package com.ssafy.backend.util;

import com.ssafy.backend.common.time.AppZone;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * LiveKit 접속용 AccessToken(JWT) 발급.
 * <p>
 * LiveKit API Key/Secret으로 서명하며 LiveKit 서버가 직접 검증한다(백엔드 roomToken과 별개).
 * identity(sub)는 participantId를 사용해 오디오 트랙 소유자/입퇴장 이벤트를 구분하고,
 * 같은 identity로 재접속 시 LiveKit이 기존 연결을 끊으므로 중복 접속이 자연스럽게 정리된다.
 * <p>
 * self-hosted LiveKit은 발급된 토큰을 폐기할 수 없으므로 TTL을 짧게(기본 10분) 잡고,
 * 재연결 시 같은 API로 재발급받는 것을 전제로 한다. 토큰 만료는 접속 시점에만 검사되어
 * 이미 연결된 세션은 만료돼도 유지된다.
 */
@Component
public class LivekitTokenProvider {

    private final String apiKey;
    private final SecretKey secretKey;
    private final long tokenExpiresIn;

    public LivekitTokenProvider(
            @Value("${livekit.api-key}") String apiKey,
            @Value("${livekit.api-secret}") String apiSecret,
            @Value("${livekit.token-expiration}") long tokenExpiresIn
    ) {
        this.apiKey = apiKey;
        this.secretKey = Keys.hmacShaKeyFor(apiSecret.getBytes(StandardCharsets.UTF_8));
        if (tokenExpiresIn <= 0) {
            throw new IllegalArgumentException("livekit.token-expiration은 0보다 커야 합니다.");
        }
        this.tokenExpiresIn = tokenExpiresIn;
    }

    /**
     * 참가자용 LiveKit 토큰 발급. 만료 시각은 min(now + 설정값, 방 만료 시각)
     * — 방이 닫힌 뒤에도 새 접속이 가능하면 안 되기 때문 (roomToken과 동일한 정책).
     * <p>
     * 권한은 음성 통화에 필요한 최소로 제한: 마이크 트랙만 publish 가능, data 채널 불가.
     */
    public IssuedToken createParticipantToken(
            Long participantId,
            String nickname,
            String livekitRoomName,
            LocalDateTime roomExpiresAt
    ) {
        long now = System.currentTimeMillis();
        long roomExpiry = roomExpiresAt.atZone(AppZone.KST).toInstant().toEpochMilli();
        long expiry = Math.min(now + tokenExpiresIn, roomExpiry);

        Map<String, Object> videoGrant = new LinkedHashMap<>();
        videoGrant.put("roomJoin", true);
        videoGrant.put("room", livekitRoomName);
        videoGrant.put("canPublish", true);
        videoGrant.put("canSubscribe", true);
        videoGrant.put("canPublishData", false);
        videoGrant.put("canPublishSources", List.of("microphone"));

        String token = Jwts.builder()
                .issuer(apiKey)                               // LiveKit API Key
                .subject(String.valueOf(participantId))       // LiveKit identity
                .claim("name", nickname)                      // 표시 이름
                .claim("video", videoGrant)
                .issuedAt(new Date(now))
                .notBefore(new Date(now))
                .expiration(new Date(expiry))
                .signWith(secretKey)
                .compact();

        return new IssuedToken(token, Instant.ofEpochMilli(expiry));
    }

    public record IssuedToken(String token, Instant expiresAt) {}
}
