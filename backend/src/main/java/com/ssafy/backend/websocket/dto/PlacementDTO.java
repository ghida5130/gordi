package com.ssafy.backend.websocket.dto;

/**
 * 아이템 하나의 배치 좌표.
 * - tierId=null: 미분류 영역
 * - position: 영역 내부 정렬 값. 10000, 20000처럼 간격을 둔 sparse 값으로,
 *   클라이언트는 값 크기 순으로 정렬해서 표시한다.
 */
public record PlacementDTO(
        Long roomItemId,
        Long tierId,
        Integer position
) {
}
