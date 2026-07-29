package com.ssafy.backend.dto.room;

import java.time.Instant;

public record RoomCreateResponseDTO(
        Long roomId,
        String roomCode,
        String status,
        long candidateCount,
        Integer maxParticipants,
        Long participantId,
        String roomToken,
        String webSocketUrl,
        Instant expiresAt
) {
}
