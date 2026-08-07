package com.ssafy.backend.websocket.dto;

import java.util.List;

/**
 * SEND /app/rooms/{roomId}/fitting-draft/update 요청 body.
 *
 * <p>피팅 초안은 방 버전과 별도의 draftRevision으로 동시 수정을 제어한다.</p>
 */
public record FittingDraftUpdateRequestDTO(
        String clientEventId,
        Long baseVersion,
        Long baseDraftRevision,
        Data data
) {

    public record Data(
            List<FittingDraftSizeSelectionDTO> sizeSelections,
            FittingDraftWearOptionsDTO wearOptions,
            String prompt
    ) {
    }
}
