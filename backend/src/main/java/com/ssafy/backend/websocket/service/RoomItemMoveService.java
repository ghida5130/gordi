package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.websocket.dto.ItemMoveRequestDTO;
import com.ssafy.backend.websocket.dto.PlacementDTO;
import com.ssafy.backend.websocket.event.ItemMovedEvent;
import com.ssafy.backend.websocket.event.ItemUnlockReason;
import com.ssafy.backend.websocket.event.ItemUnlockRequestedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 아이템 이동(ITEM_MOVED) 처리.
 * <p>
 * - 버전 검증: 조건부 UPDATE(bumpVersionIfMatches)로 baseVersion 일치 검증과 버전 증가를
 *   원자적으로 수행한다. 불일치면 VERSION_CONFLICT.
 * - position 전략: 영역(티어/미분류)마다 10000 간격의 sparse 값을 사용한다.
 *   중간 삽입은 이웃 값의 중간값, 간격이 소진되면 영역 전체를 10000 간격으로 재부여한다.
 * - 성공 시 방 전체 placements를 담은 도메인 이벤트를 발행하고,
 *   RoomEventPublisher가 커밋 후 방 토픽으로 브로드캐스트한다.
 */
@Service
@RequiredArgsConstructor
public class RoomItemMoveService {

    private static final int POSITION_STEP = 10_000;

    private final RoomRepository roomRepository;
    private final RoomItemRepository roomItemRepository;
    private final TierRepository tierRepository;
    private final RoomItemLockService roomItemLockService;
    private final ApplicationEventPublisher eventPublisher;

    // - 인자: 방 ID, 요청자 participantId, 이동 요청(clientEventId/baseVersion/data)
    // - 동작: 검증 → 버전 증가 → sparse position 계산·배치 → ItemMovedEvent 발행
    @Transactional
    public void moveItem(Long roomId, Long senderParticipantId, ItemMoveRequestDTO request) {
        validateRequest(request);

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateActive(room);

        // 다른 참여자가 유효한 잠금을 보유 중이면 이동 거부 (드래그 충돌 방지)
        if (roomItemLockService.isLockedByOther(roomId, request.data().roomItemId(), senderParticipantId)) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "다른 참여자가 잠근 상품입니다.",
                    Map.of("roomItemId", request.data().roomItemId())
            );
        }

        if (roomRepository.bumpVersionIfMatches(roomId, request.baseVersion()) == 0) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT);
        }
        long newVersion = request.baseVersion() + 1;

        List<RoomItem> items = roomItemRepository.findAllByRoomIdOrderByPositionAsc(roomId);
        RoomItem moving = items.stream()
                .filter(item -> item.getId().equals(request.data().roomItemId()))
                .findFirst()
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("resource", "roomItem")
                ));

        Long targetTierId = request.data().targetTierId();
        Tier targetTier = resolveTargetTier(roomId, targetTierId);

        // 대상 영역의 아이템(이동 아이템 제외, position 오름차순 유지)
        List<RoomItem> targetArea = items.stream()
                .filter(item -> Objects.equals(tierIdOf(item), targetTierId))
                .filter(item -> !item.getId().equals(moving.getId()))
                .toList();
        int index = clampIndex(request.data().newIndex(), targetArea.size());

        place(moving, targetTier, targetArea, index);

        eventPublisher.publishEvent(new ItemMovedEvent(
                roomId,
                newVersion,
                senderParticipantId,
                request.clientEventId(),
                toPlacements(items)
        ));

        // 드래그 잠금 자동 해제: 커밋 후 ITEM_MOVED에 이어 ITEM_UNLOCKED(MOVE_COMPLETED) 방송
        // (같은 트랜잭션에서 발행 순서가 보장되므로 항상 ITEM_MOVED 다음에 도착한다)
        String lockToken = request.data().lockToken();
        if (lockToken != null && !lockToken.isBlank()) {
            eventPublisher.publishEvent(new ItemUnlockRequestedEvent(
                    roomId,
                    newVersion,
                    senderParticipantId,
                    request.clientEventId(),
                    request.data().roomItemId(),
                    lockToken,
                    ItemUnlockReason.MOVE_COMPLETED
            ));
        }
    }

    // - 인자: 이동 아이템, 대상 티어(null=미분류), 대상 영역 아이템 목록, 목표 인덱스
    // - 동작: 이웃 간 중간값으로 sparse position 부여. 간격 소진 시 영역 전체 재번호
    private void place(RoomItem moving, Tier targetTier, List<RoomItem> targetArea, int index) {
        moving.setTier(targetTier);

        Integer sparsePosition = computeSparsePosition(targetArea, index);
        if (sparsePosition != null) {
            moving.setPosition(sparsePosition);
            return;
        }

        // 간격 소진 → 영역 전체를 10000 간격으로 재부여
        List<RoomItem> reordered = new ArrayList<>(targetArea);
        reordered.add(index, moving);
        for (int i = 0; i < reordered.size(); i++) {
            reordered.get(i).setPosition(POSITION_STEP * (i + 1));
        }
    }

    // - 인자: 대상 영역 아이템 목록(position 오름차순), 목표 인덱스
    // - 동작: 삽입 위치의 sparse position 계산. 유효한 간격이 없으면 null(재번호 필요)
    private Integer computeSparsePosition(List<RoomItem> area, int index) {
        if (area.isEmpty()) {
            return POSITION_STEP;
        }
        if (index == 0) {
            int first = area.get(0).getPosition();
            return first >= 2 ? first / 2 : null;
        }
        if (index >= area.size()) {
            return area.get(area.size() - 1).getPosition() + POSITION_STEP;
        }
        int previous = area.get(index - 1).getPosition();
        int next = area.get(index).getPosition();
        int middle = previous + (next - previous) / 2;
        return middle > previous ? middle : null;
    }

    private Tier resolveTargetTier(Long roomId, Long targetTierId) {
        if (targetTierId == null) {
            return null; // 미분류 영역
        }
        Tier tier = tierRepository.findById(targetTierId)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("resource", "tier")
                ));
        if (!tier.getRoom().getId().equals(roomId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, Map.of("resource", "tier"));
        }
        return tier;
    }

    private List<PlacementDTO> toPlacements(List<RoomItem> items) {
        return items.stream()
                .map(item -> new PlacementDTO(item.getId(), tierIdOf(item), item.getPosition()))
                .toList();
    }

    private Long tierIdOf(RoomItem item) {
        return item.getTier() == null ? null : item.getTier().getId();
    }

    private int clampIndex(Integer newIndex, int areaSize) {
        return Math.max(0, Math.min(newIndex, areaSize));
    }

    private void validateRequest(ItemMoveRequestDTO request) {
        if (request == null
                || request.baseVersion() == null
                || request.data() == null
                || request.data().roomItemId() == null
                || request.data().newIndex() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }

    private void validateActive(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        boolean closedStatus = "FINISHED".equals(room.getStatus())
                || "CLOSED".equals(room.getStatus());
        if (expired || closedStatus) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
    }
}
