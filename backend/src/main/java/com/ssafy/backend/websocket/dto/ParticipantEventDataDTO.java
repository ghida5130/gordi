package com.ssafy.backend.websocket.dto;

/**
 * PARTICIPANT_JOINED / PARTICIPANT_LEFT 이벤트의 data payload.
 */
public record ParticipantEventDataDTO(
        Long participantId,
        String nickname,
        String role
) {
}
