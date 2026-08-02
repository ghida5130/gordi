package com.ssafy.backend.dto.room;

import java.time.Instant;

/**
 * POST /api/v1/rooms/{roomCode}/voice/token 응답.
 *
 * @param serverUrl        LiveKit 서버 WebSocket URL (wss://...)
 * @param participantToken LiveKit 접속용 JWT
 * @param expiresAt        토큰 만료 시각 (재발급 스케줄링용)
 */
public record VoiceTokenResponseDTO(
        String serverUrl,
        String participantToken,
        Instant expiresAt
) {}
