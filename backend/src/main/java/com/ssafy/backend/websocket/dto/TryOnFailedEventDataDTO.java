package com.ssafy.backend.websocket.dto;

public record TryOnFailedEventDataDTO(
        Long jobId,
        String reason
) {
}
