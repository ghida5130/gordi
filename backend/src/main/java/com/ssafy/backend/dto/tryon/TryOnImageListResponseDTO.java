package com.ssafy.backend.dto.tryon;

import java.time.Instant;
import java.util.List;

/** GET /api/v1/users/me/try-on-images 응답. */
public record TryOnImageListResponseDTO(
        List<Item> images,
        int page,
        int size,
        long totalElements
) {

    public record Item(
            Long jobId,
            String imageUrl,
            Integer width,
            Integer height,
            Instant createdAt,
            Instant completedAt
    ) {
    }
}
