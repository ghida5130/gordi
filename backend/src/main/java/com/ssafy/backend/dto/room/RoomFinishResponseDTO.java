package com.ssafy.backend.dto.room;

import java.time.Instant;
import java.util.List;

public record RoomFinishResponseDTO(
        Long resultId,
        Long roomId,
        String status,
        List<TopItem> topItems,
        String snapshotImageUrl,
        Instant finishedAt
) {
    public record TopItem(
            Long productId,
            String name,
            String brand,
            Integer price,
            String imageUrl
    ) {
    }
}
