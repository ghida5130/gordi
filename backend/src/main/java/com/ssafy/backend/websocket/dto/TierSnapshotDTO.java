package com.ssafy.backend.websocket.dto;

import java.util.List;

/**
 * BOARD_SNAPSHOT 안의 티어 한 줄(이름/순서/배치된 아이템).
 */
public record TierSnapshotDTO(
        Long tierId,
        String name,
        Integer position,
        List<ItemSnapshotDTO> items
) {
}
