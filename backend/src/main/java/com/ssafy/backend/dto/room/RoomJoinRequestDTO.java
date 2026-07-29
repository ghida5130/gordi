package com.ssafy.backend.dto.room;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoomJoinRequestDTO(
        @NotBlank
        @Size(max = 20)
        String nickname
) {
}
