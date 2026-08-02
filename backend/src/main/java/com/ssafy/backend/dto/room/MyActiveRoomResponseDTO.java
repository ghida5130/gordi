package com.ssafy.backend.dto.room;

import java.time.Instant;

public record MyActiveRoomResponseDTO(ActiveRoom activeRoom) {
    public record ActiveRoom(
            Long roomId, String roomCode, String status, String role, Instant expiresAt
    ) {}
}