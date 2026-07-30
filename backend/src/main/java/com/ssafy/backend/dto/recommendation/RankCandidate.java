package com.ssafy.backend.dto.recommendation;

import com.ssafy.backend.domain.Product;

// FastAPI 순위 계산에 넘기는 후보 상품
public record RankCandidate(
        Long productId,
        String name,
        String brand,
        Integer price,
        String category,
        String subcategory,
        String description
) {

    public static RankCandidate from(Product product) {
        return new RankCandidate(
                product.getId(),
                product.getName(),
                product.getBrand(),
                product.getPrice(),
                product.getCategory(),
                product.getSubcategory(),
                product.getDescription()
        );
    }
}
