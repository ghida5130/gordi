package com.ssafy.backend.websocket.event;

/**
 * 티어 이름 변경 도메인 이벤트.
 * TierRenameService가 트랜잭션 안에서 발행하고,
 * RoomEventPublisher가 커밋 후(AFTER_COMMIT) TIER_RENAMED로 브로드캐스트한다.
 */
public record TierRenamedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        String clientEventId,
        Long tierId,
        String name
) {
}
