package com.ssafy.backend.dto.candidate;

import jakarta.validation.constraints.NotNull;

public record CandidateAddRequestDTO(
        @NotNull Long roomId,
        @NotNull Long productId
) {}
