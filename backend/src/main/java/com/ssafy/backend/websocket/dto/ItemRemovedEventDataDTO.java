package com.ssafy.backend.websocket.dto;

/**
 * ITEM_REMOVED 이벤트의 data payload.
 */
public record ItemRemovedEventDataDTO(
        Long roomItemId,
        Long productId
) {
}
