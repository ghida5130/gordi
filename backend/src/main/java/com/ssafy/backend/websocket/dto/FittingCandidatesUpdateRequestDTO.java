package com.ssafy.backend.websocket.dto;

/**
 * SEND /app/rooms/{roomId}/fitting-candidates/update 요청 body.
 * 피팅 후보 변경은 방 버전을 증가시키지 않지만, baseVersion이 최신 방 버전과
 * 일치할 때만 처리한다.
 */
public record FittingCandidatesUpdateRequestDTO(
        String clientEventId,
        Long baseVersion,
        FittingCandidatesUpdateDataDTO data
) {

    public record FittingCandidatesUpdateDataDTO(
            Long roomItemId,
            Boolean selected
    ) {
    }
}
