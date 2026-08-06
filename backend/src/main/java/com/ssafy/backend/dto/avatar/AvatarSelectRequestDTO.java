package com.ssafy.backend.dto.avatar;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AvatarSelectRequestDTO(
        @NotNull @Positive Long avatarId,
        @Positive Integer height,
        @Positive Integer weight
) {}