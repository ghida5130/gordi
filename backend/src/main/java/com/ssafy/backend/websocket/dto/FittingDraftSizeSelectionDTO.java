package com.ssafy.backend.websocket.dto;

/**
 * 피팅 초안에서 방 아이템별로 선택한 사이즈.
 */
public record FittingDraftSizeSelectionDTO(
        Long roomItemId,
        String sizeName
) {
}
