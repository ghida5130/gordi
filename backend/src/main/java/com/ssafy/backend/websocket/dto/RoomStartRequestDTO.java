package com.ssafy.backend.websocket.dto;

import java.util.Map;

/**
 * SEND /app/rooms/{roomId}/start 요청 body. (HOST 전용)
 * - baseVersion: 클라이언트가 마지막으로 알고 있는 방 버전. 불일치 시 VERSION_CONFLICT.
 * - data: 현재는 빈 객체({}). 확장 대비로 수신만 하고 사용하지 않는다.
 */
public record RoomStartRequestDTO(
        String clientEventId,
        Long baseVersion,
        Map<String, Object> data
) {
}
