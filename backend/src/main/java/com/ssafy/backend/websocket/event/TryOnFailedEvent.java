package com.ssafy.backend.websocket.event;

public record TryOnFailedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        Long jobId,
        String reason
) {
}
