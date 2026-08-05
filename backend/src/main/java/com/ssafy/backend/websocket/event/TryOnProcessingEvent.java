package com.ssafy.backend.websocket.event;

public record TryOnProcessingEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        Long jobId
) {
}
