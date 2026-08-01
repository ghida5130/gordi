package com.ssafy.backend.websocket.dto;

import com.ssafy.backend.websocket.event.ItemUnlockReason;

/**
 * ITEM_UNLOCKED 이벤트의 data payload.
 */
public record ItemUnlockedEventDataDTO(
        Long roomItemId,
        ItemUnlockReason reason
) {
}
