package com.ssafy.backend.websocket.dto;

/**
 * 피팅 초안의 착용 방식 옵션. 선택하지 않은 옵션은 null이다.
 */
public record FittingDraftWearOptionsDTO(
        String topTuck,
        String outerClosure,
        String sleeves
) {
}
