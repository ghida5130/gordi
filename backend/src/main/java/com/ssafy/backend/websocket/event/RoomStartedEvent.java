package com.ssafy.backend.websocket.event;

/**
 * 방 시작 도메인 이벤트.
 * RoomStartService가 트랜잭션 안에서 발행하고,
 * RoomEventPublisher가 커밋 후(AFTER_COMMIT) ROOM_STARTED로 브로드캐스트한다.
 */
public record RoomStartedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        String clientEventId
) {
}
