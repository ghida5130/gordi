package com.ssafy.backend.websocket.dto;

import java.util.List;

/**
 * BOARD_SNAPSHOT 이벤트의 data payload.
 * /app/rooms/{roomId}/sync 요청에 대한 최신 방 전체 상태.
 */
public record BoardSnapshotDataDTO(
        String status,
        List<ParticipantEventDataDTO> participants,
        List<TierSnapshotDTO> tiers,
        List<ItemSnapshotDTO> unclassifiedItems,
        List<FittingCandidateDTO> fittingCandidates,
        FittingDraftSnapshotDTO fittingDraft
) {
}
