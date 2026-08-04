package com.ssafy.backend.websocket.event;

import com.ssafy.backend.websocket.dto.FittingCandidateDTO;

import java.util.List;

/**
 * 피팅 후보 변경 트랜잭션이 커밋된 뒤 방 전체에 방송할 이벤트.
 */
public record FittingCandidatesUpdatedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        String clientEventId,
        List<FittingCandidateDTO> fittingCandidates
) {
}
