package com.ssafy.backend.websocket.dto;

import java.util.List;

/**
 * ITEM_MOVED 이벤트의 data payload.
 * placements: 이동 처리 후 서버가 확정한 방의 전체 아이템 배치.
 * 클라이언트는 로컬 계산 없이 이 목록으로 상태를 교체한다.
 */
public record ItemMovedEventDataDTO(
        List<PlacementDTO> placements
) {
}
