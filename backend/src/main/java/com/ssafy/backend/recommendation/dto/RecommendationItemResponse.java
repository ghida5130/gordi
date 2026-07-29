package com.ssafy.backend.recommendation.dto;

import com.ssafy.backend.domain.Product;
import com.ssafy.backend.recommendation.domain.RecommendationItem;

import java.math.BigDecimal;

// 추천 결과 개별 상품
public record RecommendationItemResponse(
        Long productId,
        String name,
        String brand,
        Integer price,
        String currency,
        String category,
        String subcategory,
        String imageUrl,
        String purchaseUrl,
        Integer rank,
        BigDecimal score
) {

    public static RecommendationItemResponse from(RecommendationItem item) {
        Product product = item.getProduct();
        return new RecommendationItemResponse(
                product.getId(),
                product.getName(),
                product.getBrand(),
                product.getPrice(),
                product.getCurrency(),
                product.getCategory(),
                product.getSubcategory(),
                product.getImageUrl(),
                product.getPurchaseUrl(),
                item.getRank(),
                item.getScore()
        );
    }
}
