package com.ssafy.backend.websocket.dto;

/**
 * ITEM_LOCK_REJECTED 이벤트의 data payload. (요청자 개인 큐 /user/queue/item-locks 전용)
 * - code: 거절 사유 (예: ITEM_ALREADY_LOCKED)
 * - owner*: 현재 잠금을 보유한 참여자 정보
 */
public record ItemLockRejectedEventDataDTO(
        Long roomItemId,
        String code,
        Long ownerParticipantId,
        String ownerNickname
) {
}
