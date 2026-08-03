package com.ssafy.backend.websocket.dto;

import com.ssafy.backend.websocket.event.ParticipantLeaveReason;

/** PARTICIPANT_LEFT 이벤트의 data payload. */
public record ParticipantLeftEventDataDTO(
        Long participantId,
        ParticipantLeaveReason reason
) {
}
