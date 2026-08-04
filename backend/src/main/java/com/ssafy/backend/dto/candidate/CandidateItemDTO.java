package com.ssafy.backend.dto.candidate;

/**
 * 후보 의상 목록과 ITEM_ADDED 이벤트가 공유하는 상품 카드 정보.
 */
public record CandidateItemDTO(
        Long roomItemId,
        Long productId,
        String name,
        String brand,
        int price,
        String imageUrl,
        Integer position,
        Long tierId
) {
}
