package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.websocket.dto.BoardSnapshotDataDTO;
import com.ssafy.backend.websocket.dto.FittingCandidateDTO;
import com.ssafy.backend.websocket.dto.ItemSnapshotDTO;
import com.ssafy.backend.websocket.dto.ParticipantEventDataDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.dto.TierSnapshotDTO;
import com.ssafy.backend.websocket.event.RoomEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * /app/rooms/{roomId}/sync 요청에 대한 방 전체 스냅샷(BOARD_SNAPSHOT)을 조립한다.
 * 참여자/티어/아이템을 한 트랜잭션에서 읽어 Room.version과 함께 반환하므로,
 * 클라이언트는 이 version보다 낮은 이벤트를 버리는 방식으로 상태를 동기화한다.
 */
@Service
@RequiredArgsConstructor
public class RoomSyncService {

    private final RoomRepository roomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final TierRepository tierRepository;
    private final RoomItemRepository roomItemRepository;

    // - 인자: 방 ID, 요청 식별자(clientEventId, null 허용), 요청자 participantId
    // - 동작: 방 상태/참여자/티어별 아이템/미분류 아이템을 조회해 BOARD_SNAPSHOT envelope로 반환
    @Transactional(readOnly = true)
    public RoomEventDTO buildSnapshot(Long roomId, String clientEventId, Long requesterParticipantId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));

        List<ParticipantEventDataDTO> participants = roomParticipantRepository
                .findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(roomId)
                .stream()
                .map(participant -> new ParticipantEventDataDTO(
                        participant.getId(),
                        participant.getNickname(),
                        participant.getRole()
                ))
                .toList();

        List<RoomItem> items = roomItemRepository.findAllByRoomIdWithProduct(roomId);

        // tierId별 아이템 그룹핑 (position 오름차순은 조회 쿼리에서 보장)
        Map<Long, List<ItemSnapshotDTO>> itemsByTierId = items.stream()
                .filter(item -> item.getTier() != null)
                .collect(Collectors.groupingBy(
                        item -> item.getTier().getId(),
                        Collectors.mapping(this::toItemSnapshot, Collectors.toList())
                ));

        List<TierSnapshotDTO> tiers = tierRepository
                .findAllByRoomIdOrderByPositionAsc(roomId)
                .stream()
                .map(tier -> toTierSnapshot(tier, itemsByTierId))
                .toList();

        List<ItemSnapshotDTO> unclassifiedItems = items.stream()
                .filter(item -> item.getTier() == null)
                .map(this::toItemSnapshot)
                .toList();

        List<FittingCandidateDTO> fittingCandidates = items.stream()
                .filter(RoomItem::isFittingCandidate)
                .map(item -> new FittingCandidateDTO(item.getId()))
                .toList();

        return RoomEventDTO.of(
                RoomEventType.BOARD_SNAPSHOT,
                clientEventId,
                roomId,
                room.getVersion(),
                requesterParticipantId,
                new BoardSnapshotDataDTO(
                        room.getStatus(),
                        participants,
                        tiers,
                        unclassifiedItems,
                        fittingCandidates
                )
        );
    }

    private ItemSnapshotDTO toItemSnapshot(RoomItem item) {
        return new ItemSnapshotDTO(
                item.getId(),
                item.getProduct().getId(),
                item.getPosition()
        );
    }

    private TierSnapshotDTO toTierSnapshot(Tier tier, Map<Long, List<ItemSnapshotDTO>> itemsByTierId) {
        return new TierSnapshotDTO(
                tier.getId(),
                tier.getName(),
                tier.getPosition(),
                itemsByTierId.getOrDefault(tier.getId(), List.of())
        );
    }
}
