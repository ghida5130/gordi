package com.ssafy.backend.dto.recommendation;

import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.RecommendationItem;

import java.math.BigDecimal;
import java.util.function.UnaryOperator;

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

    public static RecommendationItemResponse from(
            RecommendationItem item, UnaryOperator<String> imageUrlResolver) {
        Product product = item.getProduct();
        return new RecommendationItemResponse(
                product.getId(),
                product.getName(),
                product.getBrand(),
                product.getPrice(),
                product.getCurrency(),
                product.getCategory(),
                product.getSubcategory(),
                imageUrlResolver.apply(product.getImageUrl()),
                product.getPurchaseUrl(),
                item.getRank(),
                item.getScore()
        );
    }
}
