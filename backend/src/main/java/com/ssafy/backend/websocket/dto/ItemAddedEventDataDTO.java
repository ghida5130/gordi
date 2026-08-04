package com.ssafy.backend.websocket.dto;

import com.ssafy.backend.dto.candidate.CandidateItemDTO;

import java.util.List;

/**
 * ITEM_ADDED 이벤트의 data payload.
 * item은 즉시 화면에 표시할 후보 의상 정보이고 placements는 추가 처리 후 전체 배치다.
 */
public record ItemAddedEventDataDTO(
        CandidateItemDTO item,
        List<PlacementDTO> placements
) {
}
