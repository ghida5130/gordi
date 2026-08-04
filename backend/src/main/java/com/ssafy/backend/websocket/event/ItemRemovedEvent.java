package com.ssafy.backend.websocket.event;

/**
 * 후보 의상 삭제 도메인 이벤트.
 * CandidateService가 트랜잭션 안에서 발행하고 RoomEventPublisher가 커밋 후 방송한다.
 */
public record ItemRemovedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        Long roomItemId,
        Long productId
) {
}
