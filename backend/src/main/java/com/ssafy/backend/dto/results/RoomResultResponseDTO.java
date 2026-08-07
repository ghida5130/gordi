package com.ssafy.backend.dto.results;

import java.time.Instant;
import java.util.List;

public record RoomResultResponseDTO(
        Long resultId,
        String roomCode,
        Long boardVersion,
        List<Tier> tiers,
        List<TopItem> topItems,
        String snapshotImageUrl,
        List<String> fitSummary,
        String disclaimer,
        Instant createdAt
) {
    public record Tier(
            Long tierId,
            String tierName,
            int position
    ) {
    }

    public record TopItem(
            int rank,
            Long roomItemId,
            Long productId,
            String name,
            String brand,
            int price,
            String imageUrl,
            String purchaseUrl,
            int position,
            TierInfo tier
    ) {
    }

    public record TierInfo(
            Long tierId,
            String tierName
    ) {
    }
}
