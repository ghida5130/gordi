package com.ssafy.backend.websocket.dto;

/**
 * /app/rooms/{roomId}/sync SEND 요청 body.
 * clientEventId는 스냅샷 응답의 clientEventId로 그대로 반환된다. (없으면 null)
 */
public record RoomSyncRequestDTO(
        String clientEventId
) {
}
