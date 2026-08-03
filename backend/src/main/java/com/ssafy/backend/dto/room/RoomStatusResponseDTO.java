package com.ssafy.backend.dto.room;

import java.time.Instant;
import java.util.List;

public record RoomStatusResponseDTO(
        Long roomId,
        String roomCode,
        String status,
        Long version,
        Instant expiresAt,
        List<Participant> participants,
        List<Tier> tiers
) {
    public record Participant(
            Long participantId,
            String nickname,
            String role
    ) {
    }

    public record Tier(
            Long tierId,
            String name,
            Integer position
    ) {
    }
}
