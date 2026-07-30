package com.ssafy.backend.websocket.dto;

/**
 * ROOM_STARTED 이벤트의 data payload.
 */
public record RoomStartedEventDataDTO(
        String status
) {
}
