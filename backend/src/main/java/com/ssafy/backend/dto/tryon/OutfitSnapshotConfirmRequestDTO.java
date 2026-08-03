package com.ssafy.backend.dto.tryon;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * PUT /api/v1/rooms/{roomCode}/outfit-snapshot 요청.
 * boardVersion 은 확정 시점의 방 버전이어야 하며 다르면 VERSION_CONFLICT 로 거절한다.
 */
public record OutfitSnapshotConfirmRequestDTO(
        @NotNull @Positive Long jobId,
        @NotNull @PositiveOrZero Long boardVersion
) {
}
