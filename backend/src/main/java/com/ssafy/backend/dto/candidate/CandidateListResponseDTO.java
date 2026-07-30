package com.ssafy.backend.dto.candidate;

import java.util.List;

// CandidateListResponseDTO (목록 조회용)
public record CandidateListResponseDTO(Long roomId, int totalCount, List<Item> items) {
    public record Item(Long roomItemId, Long productId, String name, String brand,
                       int price, String imageUrl, Integer position, Long tierId) {}
}
