package com.ssafy.backend.websocket.dto;

/**
 * SEND /app/rooms/{roomId}/tiers/rename 요청 body. (HOST 전용)
 * - baseVersion: 클라이언트가 마지막으로 알고 있는 방 버전. 불일치 시 VERSION_CONFLICT.
 */
public record TierRenameRequestDTO(
        String clientEventId,
        Long baseVersion,
        TierRenameDataDTO data
) {

    public record TierRenameDataDTO(
            Long tierId,
            String name
    ) {
    }
}
