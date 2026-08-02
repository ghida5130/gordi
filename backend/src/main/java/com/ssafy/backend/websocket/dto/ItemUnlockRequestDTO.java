package com.ssafy.backend.websocket.dto;

import com.ssafy.backend.websocket.event.ItemUnlockReason;

/**
 * SEND /app/rooms/{roomId}/items/unlock 요청 body.
 * - lockToken: 잠금 획득 때 보낸 토큰. 저장된 값과 일치해야 해제된다.
 *   (이전 드래그의 늦게 도착한 unlock이 새 잠금을 삭제하는 문제를 막는다)
 * - reason: 해제 사유 (예: CANCELLED). 방송되는 ITEM_UNLOCKED에 그대로 실린다.
 */
public record ItemUnlockRequestDTO(
        String clientEventId,
        ItemUnlockDataDTO data
) {

    public record ItemUnlockDataDTO(
            Long roomItemId,
            String lockToken,
            ItemUnlockReason reason
    ) {
    }
}
