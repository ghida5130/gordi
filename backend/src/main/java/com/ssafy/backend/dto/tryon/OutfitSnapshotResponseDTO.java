package com.ssafy.backend.dto.tryon;

/** PUT /api/v1/rooms/{roomCode}/outfit-snapshot 응답. version 은 확정으로 증가한 방 버전이다. */
public record OutfitSnapshotResponseDTO(
        String roomCode,
        Long confirmedTryOnJobId,
        Long version
) {
}
