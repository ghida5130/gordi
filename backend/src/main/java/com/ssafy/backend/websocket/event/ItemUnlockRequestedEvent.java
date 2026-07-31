package com.ssafy.backend.websocket.event;

/**
 * 잠금 해제 요청 도메인 이벤트.
 * RoomItemMoveService가 이동 트랜잭션 안에서 발행하고,
 * RoomItemLockService가 커밋 후(AFTER_COMMIT) 실제 잠금을 해제한 뒤
 * ITEM_UNLOCKED를 브로드캐스트한다. (커밋 후 해제라 롤백 시 잠금이 유지된다)
 * lockToken은 소유자 검증에만 쓰고 브로드캐스트에는 포함하지 않는다.
 */
public record ItemUnlockRequestedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        String clientEventId,
        Long roomItemId,
        String lockToken,
        ItemUnlockReason reason
) {
}
