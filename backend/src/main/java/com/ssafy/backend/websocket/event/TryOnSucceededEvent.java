package com.ssafy.backend.websocket.event;

public record TryOnSucceededEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        Long jobId,
        String resultImageUrl
) {
}
