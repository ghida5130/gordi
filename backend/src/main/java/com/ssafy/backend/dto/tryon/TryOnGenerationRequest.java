package com.ssafy.backend.dto.tryon;

import java.util.List;

/**
 * POST /internal/v1/try-on-jobs 요청 (외부 생성 서비스 연동 계약).
 * <p>
 * <b>미확정</b>: 생성 완료 결과를 Spring 이 되돌려 받는 방식(콜백 / 폴링 / 메시지 큐)이 아직
 * 정해지지 않았다. 그래서 이 요청에는 접수에 필요한 입력만 담고 콜백 주소는 포함하지 않는다.
 * 방식이 정해지면 이 레코드와 {@link com.ssafy.backend.infra.TryOnGenerationClient} 만 수정한다.
 */
public record TryOnGenerationRequest(
        Long jobId,
        Long avatarId,
        String avatarImageUrl,
        List<Item> items,
        WearOptions wearOptions,
        String prompt
) {

    public record Item(
            Long productId,
            String slot,
            String imageUrl,
            Integer position
    ) {
    }

    public record WearOptions(
            String topTuck,
            String outerClosure,
            String sleeves
    ) {
    }
}
