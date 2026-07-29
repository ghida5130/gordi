package com.ssafy.backend.util;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;

/**
 * 방 참가자 인증용 roomToken 발급/검증.
 * type claim("room")으로 access/refresh 토큰과 교차 사용을 차단한다.
 * WebSocket STOMP CONNECT의 Authorization 헤더 검증에도 사용된다.
 */
@Component
public class RoomTokenProvider {

    private static final String TOKEN_TYPE = "room";

    private final SecretKey secretKey;
    private final long roomTokenExpiresIn;

    public RoomTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.room-token-expiration}") long roomTokenExpiresIn
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.roomTokenExpiresIn = roomTokenExpiresIn;
    }

    /**
     * roomToken 발급. 만료 시각은 min(now + 설정값, 방 만료 시각)
     * — 방이 닫힌 뒤에도 토큰이 살아있으면 안 되기 때문.
     */
    public String createRoomToken(Long participantId, Long roomId,
                                  String nickname, String role,
                                  LocalDateTime roomExpiresAt) {
        long now = System.currentTimeMillis();
        long roomExpiry = roomExpiresAt.atZone(AppZone.KST).toInstant().toEpochMilli();
        long expiry = Math.min(now + roomTokenExpiresIn, roomExpiry);

        return Jwts.builder()
                .subject(String.valueOf(participantId))
                .claim("roomId", roomId)
                .claim("nickname", nickname)
                .claim("role", role)
                .claim("type", TOKEN_TYPE)
                .issuedAt(new Date(now))
                .expiration(new Date(expiry))
                .signWith(secretKey)
                .compact();
    }

    /** 검증 + 클레임 파싱. WebSocket CONNECT 인터셉터에서 사용 예정. */
    public RoomClaims parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            if (!TOKEN_TYPE.equals(claims.get("type", String.class))) {
                throw new ApiException(ErrorCode.INVALID_TOKEN);
            }

            Object roomIdClaim = claims.get("roomId");
            if (!(roomIdClaim instanceof Number roomId)) {
                throw new IllegalArgumentException("roomId claim is missing");
            }

            return new RoomClaims(
                    Long.valueOf(claims.getSubject()),
                    roomId.longValue(),
                    claims.get("nickname", String.class),
                    claims.get("role", String.class)
            );
        } catch (ExpiredJwtException e) {
            throw new ApiException(ErrorCode.TOKEN_EXPIRED);
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(ErrorCode.INVALID_TOKEN);
        }
    }

    public record RoomClaims(Long participantId, Long roomId, String nickname, String role) {}
}
