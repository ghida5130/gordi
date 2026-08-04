package com.ssafy.backend.websocket.event;

import com.ssafy.backend.dto.candidate.CandidateItemDTO;
import com.ssafy.backend.websocket.dto.PlacementDTO;

import java.util.List;

/**
 * 후보 의상 추가 도메인 이벤트.
 * CandidateService가 트랜잭션 안에서 발행하고 RoomEventPublisher가 커밋 후 방송한다.
 */
public record ItemAddedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        CandidateItemDTO item,
        List<PlacementDTO> placements
) {
}
