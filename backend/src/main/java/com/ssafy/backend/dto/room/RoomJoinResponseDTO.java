package com.ssafy.backend.dto.room;

public record RoomJoinResponseDTO(
        Long roomId,
        Long participantId,
        String role,
        String roomToken,
        String status,
        Long version
) {
}
