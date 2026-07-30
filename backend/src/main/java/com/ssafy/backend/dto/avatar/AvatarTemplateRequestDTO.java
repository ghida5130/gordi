package com.ssafy.backend.dto.avatar;

import jakarta.validation.constraints.*;

public record AvatarTemplateRequestDTO(
        @NotBlank String gender,
        @NotNull @Min(0) @Max(5) Long heightId,  // 0 = 키 미입력
        @NotNull @Min(0) @Max(5) Long weightId   // 0 = 몸무게 미입력
) {}