package com.ssafy.backend.dto.product;

import java.math.BigDecimal;
import java.util.List;

public record ProductDetailResponseDTO(
        Long id, String name, String brand, int price,
        String category, String subcategory,
        String imageUrl, String purchaseUrl, String description,
        List<TopSize> topSizes, List<BottomSize> bottomSizes
) {
    public record TopSize(Long id, String sizeName, BigDecimal totalLength,
                          BigDecimal shoulderWidth, BigDecimal chestWidth,
                          BigDecimal sleeveLength) {}

    public record BottomSize(Long id, String sizeName, BigDecimal totalLength,
                             BigDecimal waistWidth, BigDecimal hipWidth,
                             BigDecimal thighWidth, BigDecimal rise) {}
}
