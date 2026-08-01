package com.ssafy.backend.websocket.dto;

/**
 * TIER_RENAMED 이벤트의 data payload.
 */
public record TierRenamedEventDataDTO(
        Long tierId,
        String name
) {
}
