package com.ssafy.backend.websocket.dto;

import com.ssafy.backend.websocket.event.RoomEventType;

import java.util.UUID;

/**
 * 방 이벤트 브로드캐스트 공통 envelope.
 * - eventId: 서버가 이벤트마다 생성하는 고유 ID (UUID)
 * - clientEventId: 원인이 된 SEND 요청의 ID (없으면 null)
 * - version: 이벤트 처리 후 방 상태 버전 (Room.version)
 * - senderParticipantId: 요청을 발생시킨 참여자 (없으면 null)
 * - data: eventType별 세부 결과
 */
public record RoomEventDTO(
        String eventId,
        String clientEventId,
        RoomEventType eventType,
        Long roomId,
        Long version,
        Long senderParticipantId,
        Object data
) {

    // - 인자: 이벤트 종류, 요청 식별자, 방/버전/발신자 정보, payload
    // - 동작: eventId(UUID)를 채운 envelope 생성
    public static RoomEventDTO of(
            RoomEventType eventType,
            String clientEventId,
            Long roomId,
            Long version,
            Long senderParticipantId,
            Object data
    ) {
        return new RoomEventDTO(
                UUID.randomUUID().toString(),
                clientEventId,
                eventType,
                roomId,
                version,
                senderParticipantId,
                data
        );
    }
}
