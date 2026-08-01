package com.ssafy.backend.websocket.dto;

/**
 * SEND /app/rooms/{roomId}/items/move 요청 body.
 * - baseVersion: 클라이언트가 마지막으로 알고 있는 방 버전. 서버 최신 버전과 다르면 VERSION_CONFLICT.
 * - data.targetTierId: null이면 미분류 영역으로 이동
 * - data.newIndex: 대상 영역 안에서의 목표 순서(0-base). 영역 크기를 넘으면 맨 뒤로 보정
 * - data.lockToken: 드래그 시작 시 items/lock으로 획득한 잠금 토큰.
 *   이동 성공 시 서버가 잠금을 자동 해제하고 ITEM_UNLOCKED(MOVE_COMPLETED)를 이어서 방송한다.
 */
public record ItemMoveRequestDTO(
        String clientEventId,
        Long baseVersion,
        ItemMoveDataDTO data
) {

    public record ItemMoveDataDTO(
            Long roomItemId,
            Long targetTierId,
            Integer newIndex,
            String lockToken
    ) {
    }
}
