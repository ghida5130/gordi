package com.ssafy.backend.websocket.event;

import com.ssafy.backend.websocket.dto.FittingDraftSnapshotDTO;

/**
 * Redis에 피팅 초안 저장을 완료한 뒤 방 전체에 브로드캐스트할 도메인 이벤트.
 */
public record FittingDraftUpdatedEvent(
        Long roomId,
        Long roomVersion,
        Long senderParticipantId,
        String clientEventId,
        FittingDraftSnapshotDTO draft
) {
}
