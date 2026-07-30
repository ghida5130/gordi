package com.ssafy.backend.dto.users;

public record LoginResponseDTO(
        Long userId,
        String accessToken
) {
}
