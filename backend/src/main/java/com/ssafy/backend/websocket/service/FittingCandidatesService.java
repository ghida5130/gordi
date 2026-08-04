package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.FittingCandidateDTO;
import com.ssafy.backend.websocket.dto.FittingCandidatesUpdateRequestDTO;
import com.ssafy.backend.websocket.event.FittingCandidatesUpdatedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 방의 공유 피팅 후보 선택 상태를 변경한다.
 *
 * <p>방 행을 잠근 상태에서 버전을 검사하고 선택 상태를 변경하므로, 같은 방에서
 * 동시에 들어온 요청도 순서대로 전체 후보 스냅샷을 만든다. 이 상태 변경 자체는
 * Room.version을 증가시키지 않는다.</p>
 */
@Service
@RequiredArgsConstructor
public class FittingCandidatesService {

    private final RoomRepository roomRepository;
    private final RoomItemRepository roomItemRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public void update(
            Long roomId,
            Long senderParticipantId,
            FittingCandidatesUpdateRequestDTO request
    ) {
        validateRequest(request);

        Room room = roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateActive(room);

        if (!Objects.equals(room.getVersion(), request.baseVersion())) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT);
        }

        RoomItem roomItem = roomItemRepository
                .findByIdAndRoomId(request.data().roomItemId(), roomId)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("resource", "roomItem")
                ));
        roomItem.setFittingCandidate(request.data().selected());

        List<FittingCandidateDTO> fittingCandidates = roomItemRepository
                .findAllByRoomIdAndFittingCandidateTrueOrderByPositionAsc(roomId)
                .stream()
                .map(item -> new FittingCandidateDTO(item.getId()))
                .toList();

        eventPublisher.publishEvent(new FittingCandidatesUpdatedEvent(
                roomId,
                room.getVersion(),
                senderParticipantId,
                request.clientEventId(),
                fittingCandidates
        ));
    }

    private void validateRequest(FittingCandidatesUpdateRequestDTO request) {
        if (request == null
                || request.baseVersion() == null
                || request.data() == null
                || request.data().roomItemId() == null
                || request.data().selected() == null) {
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
