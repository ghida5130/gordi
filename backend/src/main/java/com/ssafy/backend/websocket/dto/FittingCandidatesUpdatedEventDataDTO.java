package com.ssafy.backend.websocket.dto;

import java.util.List;

/**
 * FITTING_CANDIDATES_UPDATED 이벤트의 전체 피팅 후보 스냅샷.
 */
public record FittingCandidatesUpdatedEventDataDTO(
        List<FittingCandidateDTO> fittingCandidates
) {
}
