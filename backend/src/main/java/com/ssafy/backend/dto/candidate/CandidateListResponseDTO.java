package com.ssafy.backend.dto.candidate;

import java.util.List;

// CandidateListResponseDTO (목록 조회용)
public record CandidateListResponseDTO(Long roomId, int totalCount, List<CandidateItemDTO> items) {
}
