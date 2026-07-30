package com.ssafy.backend.websocket.dto;

/**
 * SEND /app/rooms/{roomId}/items/move 요청 body.
 * - baseVersion: 클라이언트가 마지막으로 알고 있는 방 버전. 서버 최신 버전과 다르면 VERSION_CONFLICT.
 * - data.targetTierId: null이면 미분류 영역으로 이동
 * - data.newIndex: 대상 영역 안에서의 목표 순서(0-base). 영역 크기를 넘으면 맨 뒤로 보정
 */
public record ItemMoveRequestDTO(
        String clientEventId,
        Long baseVersion,
        ItemMoveDataDTO data
) {

    public record ItemMoveDataDTO(
            Long roomItemId,
            Long targetTierId,
            Integer newIndex
    ) {
    }
}
