package com.ssafy.backend.dto.auth;
import com.fasterxml.jackson.annotation.JsonInclude;

public record JWTResponseDTO (
        String accessToken) {
}
