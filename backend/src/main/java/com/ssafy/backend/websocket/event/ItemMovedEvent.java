package com.ssafy.backend.websocket.event;

import com.ssafy.backend.websocket.dto.PlacementDTO;

import java.util.List;

/**
 * 아이템 이동 도메인 이벤트.
 * RoomItemMoveService가 트랜잭션 안에서 발행하고,
 * RoomEventPublisher가 커밋 후(AFTER_COMMIT) ITEM_MOVED로 브로드캐스트한다.
 */
public record ItemMovedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        String clientEventId,
        List<PlacementDTO> placements
) {
}
