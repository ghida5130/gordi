package com.ssafy.backend.websocket.event;

public record RoomFinishedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId
) {
}
