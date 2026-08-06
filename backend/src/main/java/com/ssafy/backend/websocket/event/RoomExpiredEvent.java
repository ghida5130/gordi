package com.ssafy.backend.websocket.event;

public record RoomExpiredEvent(
        Long roomId,
        Long roomVersion
) {
}
