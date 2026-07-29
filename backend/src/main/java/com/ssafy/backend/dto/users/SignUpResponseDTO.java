package com.ssafy.backend.dto.users;
import io.swagger.v3.oas.annotations.media.Schema;

public record SignUpResponseDTO(
        @Schema(description = "생성된 유저 ID")
        Long userId
) { }
