package com.ssafy.backend.dto.tryon;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * POST /api/v1/try-on-jobs 요청.
 * <p>
 * 아이템 개수 상한, slot 코드 유효성, 컨텍스트별 필수값(roomCode/boardVersion 또는 productId)은
 * 두 필드를 함께 봐야 하므로 Service 에서 검증한다.
 */
public record TryOnJobCreateRequestDTO(

        @NotNull @Valid Context context,

        @NotNull @Positive Long avatarId,

        @NotEmpty @Valid List<Item> items,

        @Valid WearOptions wearOptions,

        @Size(max = 500) String prompt
) {

    /** type 은 SOLO 또는 ROOM. ROOM 이면 roomCode 와 boardVersion 이 필수다. */
    public record Context(
            @NotBlank String type,
            String roomCode,
            @PositiveOrZero Long boardVersion
    ) {
    }

    /**
     * 착장 구성 항목.
     * ROOM 컨텍스트는 roomItemId 로, SOLO 컨텍스트는 productId 로 지정한다.
     */
    public record Item(
            Long roomItemId,
            Long productId,
            @NotBlank String slot
    ) {
    }

    /** 미지정 항목은 생성 서비스의 기본값을 사용한다. */
    public record WearOptions(
            String topTuck,
            String outerClosure,
            String sleeves
    ) {
    }
}
