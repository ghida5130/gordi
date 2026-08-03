package com.ssafy.backend.websocket.event;

/**
 * 참가자 퇴장 도메인 이벤트.
 * RoomLeaveService가 트랜잭션 안에서 발행하고 커밋 후 STOMP로 브로드캐스트한다.
 */
public record ParticipantLeftEvent(
        Long roomId,
        Long roomVersion,
        Long participantId,
        String clientEventId,
        ParticipantLeaveReason reason
) {
}
