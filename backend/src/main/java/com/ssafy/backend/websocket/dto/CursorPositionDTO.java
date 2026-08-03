package com.ssafy.backend.websocket.dto;

/**
 * /topic/v1/rooms/{roomId}/cursors 로 브로드캐스트되는 커서 위치.
 * 휘발성 데이터라 RoomEventDTO envelope을 쓰지 않는 flat 메시지이며,
 * participantId는 서버가 세션 Principal에서 채운다.
 */
public record CursorPositionDTO(
        Long participantId,
        Double x,
        Double y
) {
}
