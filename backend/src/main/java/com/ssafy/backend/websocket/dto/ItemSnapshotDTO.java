package com.ssafy.backend.websocket.dto;

/**
 * BOARD_SNAPSHOT 안의 아이템 배치 정보.
 * ITEM_MOVED의 placements와 같은 좌표계(roomItemId/position)를 사용한다.
 */
public record ItemSnapshotDTO(
        Long roomItemId,
        Long productId,
        Integer position
) {
}
