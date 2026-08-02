package com.ssafy.backend.dto.room;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record RoomFinishRequestDTO(
        @NotNull @PositiveOrZero Long expectedVersion
) {
}
