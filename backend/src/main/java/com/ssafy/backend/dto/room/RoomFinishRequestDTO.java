package com.ssafy.backend.dto.room;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.HashSet;
import java.util.List;

public record RoomFinishRequestDTO(
        @NotNull @PositiveOrZero Long expectedVersion,
        @NotNull @Size(min = 1, max = 3) List<@NotNull @Positive Long> topProductIds
) {
    @AssertTrue(message = "topProductIds must not contain duplicates")
    public boolean isTopProductIdsUnique() {
        return topProductIds == null
                || new HashSet<>(topProductIds).size() == topProductIds.size();
    }
}
