package com.ssafy.backend.dto.room;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record RoomCreateRequestDTO(
        @NotNull @Positive Long recommendationId,
        @NotNull @Positive Long recommendationVersion,
        @NotNull @Min(2) @Max(4) Integer maxParticipants
) {
}
