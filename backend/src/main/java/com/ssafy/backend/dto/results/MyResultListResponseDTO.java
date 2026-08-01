package com.ssafy.backend.dto.results;

import java.time.Instant;
import java.util.List;

public record MyResultListResponseDTO(List<Item> items) {
    public record Item(
            Long resultId,
            String roomCode,
            List<TopItem> topItems,
            String snapshotImageUrl,
            Instant createdAt
    ) {}
    public record TopItem(Long productId, String name, String brand, int price, String imageUrl) {}
}
