package com.ssafy.backend.dto.product;

import java.util.List;

public record ProductSearchResponseDTO(
        List<Item> products, int page, int size, long totalElements
) {
    public record Item(Long id, String name, String brand, int price,
                       String category, String subcategory,
                       String imageUrl, String purchaseUrl) {}
}