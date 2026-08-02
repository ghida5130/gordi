package com.ssafy.backend.dto.results;

import java.time.Instant;
import java.util.List;

public record RoomResultResponseDTO(
        Long resultId,
        String roomCode,
        Long boardVersion,
        List<TopItem> topItems,
        String snapshotImageUrl,
        List<String> fitSummary,
        String disclaimer,
        Instant createdAt
) {
    public record TopItem(
            int rank,
            Long productId
    ) {
    }
}
