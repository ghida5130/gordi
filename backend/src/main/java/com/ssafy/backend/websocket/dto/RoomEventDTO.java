package com.ssafy.backend.websocket.dto;

import com.ssafy.backend.websocket.event.RoomEventType;

import java.time.Instant;
import java.util.UUID;

/**
 * 방 이벤트 브로드캐스트 공통 envelope.
 * - eventId: 서버가 발급하는 이벤트 고유 ID (UUID)
 * - clientEventId: 클라이언트 요청의 Idempotency-Key 등 요청 식별자 (없으면 null)
 * - version: 이벤트 발생 시점의 방 버전 (Room.version)
 * - data: eventType별 payload
 */
public record RoomEventDTO(
        String eventId,
        String clientEventId,
        RoomEventType eventType,
        Long roomId,
        Long version,
        Long senderParticipantId,
        Instant occurredAt,
        Object data
) {

    // - 인자: 이벤트 종류, 요청 식별자, 방/버전/발신자 정보, payload
    // - 동작: eventId(UUID)와 occurredAt(현재 시각)을 채운 envelope 생성
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
                Instant.now(),
                data
        );
    }
}
