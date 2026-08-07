package com.ssafy.backend.websocket.dto;

import java.util.List;

/**
 * Redis에 저장하고 FITTING_DRAFT_UPDATED/BOARD_SNAPSHOT으로 전달하는 전체 초안 스냅샷.
 */
public record FittingDraftSnapshotDTO(
        Long draftRevision,
        List<FittingDraftSizeSelectionDTO> sizeSelections,
        FittingDraftWearOptionsDTO wearOptions,
        String prompt
) {
}
