package com.ssafy.backend.dto.tryon;

import java.math.BigDecimal;
import java.util.List;

/**
 * POST /internal/v1/try-on-jobs 요청 (외부 생성 서비스 연동 계약).
 * <p>
 * 공개 API 는 방을 roomCode 로 식별하지만 이 계약은 roomId 를 쓴다.
 * 사이즈는 사용자가 고른 sizeName 에 해당하는 실측 행을 찾아 {@link SizeProfile} 로 펼쳐 보낸다.
 */
public record TryOnGenerationRequest(
        Long jobId,
        Context context,
        Avatar avatar,
        List<Item> items,
        WearOptions wearOptions,
        String prompt
) {

    /** SOLO 는 roomId / boardVersion 이 비어 있다. */
    public record Context(
            String type,
            Long roomId,
            Long boardVersion
    ) {
    }

    /** 키·몸무게는 아바타 프리셋의 구간 id 를 실제 cm/kg 범위로 풀어서 보낸다. */
    public record Avatar(
            Long avatarId,
            String imageUrl,
            String gender,
            String bodyType,
            Integer minHeight,
            Integer maxHeight,
            Integer minWeight,
            Integer maxWeight
    ) {
    }

    public record Item(
            Long productId,
            String slot,
            String imageUrl,
            String source,
            String description,
            SizeProfile sizeProfile
    ) {
    }

    /**
     * 옷 실측 치수. 상의와 하의는 채워지는 항목이 다르며 해당 없는 항목은 null 이다.
     * <ul>
     *   <li>상의: totalLength, shoulderWidth, chestWidth, sleeveLength</li>
     *   <li>하의: totalLength, waistWidth, hipWidth, thighWidth, rise</li>
     * </ul>
     */
    public record SizeProfile(
            String sizeName,
            BigDecimal totalLength,
            BigDecimal shoulderWidth,
            BigDecimal chestWidth,
            BigDecimal sleeveLength,
            BigDecimal waistWidth,
            BigDecimal hipWidth,
            BigDecimal thighWidth,
            BigDecimal rise
    ) {
    }

    public record WearOptions(
            String topTuck,
            String outerClosure,
            String sleeves
    ) {
    }
}
