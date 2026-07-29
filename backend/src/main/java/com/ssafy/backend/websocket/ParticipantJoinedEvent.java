package com.ssafy.backend.websocket;

/**
 * 참여자 입장(신규 입장/재입장) 도메인 이벤트.
 * RoomService가 트랜잭션 안에서 발행하고,
 * RoomEventPublisher가 커밋 후(AFTER_COMMIT) STOMP로 브로드캐스트한다.
 */
public record ParticipantJoinedEvent(
        Long roomId,
        Long roomVersion,
        Long participantId,
        String nickname,
        String role
) {
}
