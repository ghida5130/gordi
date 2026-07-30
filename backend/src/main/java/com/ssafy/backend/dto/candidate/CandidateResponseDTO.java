package com.ssafy.backend.dto.candidate;

import java.time.LocalDateTime;

public record CandidateResponseDTO(
        Long roomItemId, Long roomId, Long productId,
        Integer position, Long tierId, LocalDateTime updatedAt
) {}