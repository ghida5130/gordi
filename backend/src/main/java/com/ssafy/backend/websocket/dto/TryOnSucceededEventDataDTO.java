package com.ssafy.backend.websocket.dto;

public record TryOnSucceededEventDataDTO(
        Long jobId,
        String resultImageUrl
) {
}
