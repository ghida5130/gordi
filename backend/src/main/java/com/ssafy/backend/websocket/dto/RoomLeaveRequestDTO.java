package com.ssafy.backend.websocket.dto;

/**
 * SEND /app/rooms/{roomId}/leave 요청 body.
 * clientEventId는 성공 시 PARTICIPANT_LEFT 이벤트에 그대로 포함된다.
 */
public record RoomLeaveRequestDTO(
        String clientEventId
) {
}
