package com.ssafy.backend.websocket.dto;

/**
 * ITEM_LOCKED 이벤트의 data payload. (방 전체 브로드캐스트, lockToken 제외)
 */
public record ItemLockedEventDataDTO(
        Long roomItemId,
        Long ownerParticipantId,
        String ownerNickname
) {
}
