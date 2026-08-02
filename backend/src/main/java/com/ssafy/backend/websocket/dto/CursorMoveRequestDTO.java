package com.ssafy.backend.websocket.dto;

/**
 * SEND /app/rooms/{roomId}/cursor 요청 body.
 * x, y는 보드 기준 정규화 좌표(0.0 ~ 1.0).
 */
public record CursorMoveRequestDTO(
        Double x,
        Double y
) {
}
