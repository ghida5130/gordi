package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.aop.BusinessOperation;
import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.config.enums.OuterClosure;
import com.ssafy.backend.config.enums.Sleeves;
import com.ssafy.backend.config.enums.TopTuck;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.infra.RedisFittingDraftStore;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.FittingDraftSizeSelectionDTO;
import com.ssafy.backend.websocket.dto.FittingDraftSnapshotDTO;
import com.ssafy.backend.websocket.dto.FittingDraftUpdateRequestDTO;
import com.ssafy.backend.websocket.dto.FittingDraftWearOptionsDTO;
import com.ssafy.backend.websocket.event.FittingDraftUpdatedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 공유 피팅 초안의 전체 스냅샷을 검증하고 Redis에 저장한다.
 */
@Service
@RequiredArgsConstructor
public class FittingDraftService {

    private static final int MAX_CLIENT_EVENT_ID_LENGTH = 100;
    private static final int MAX_SIZE_NAME_LENGTH = 50;
    private static final int MAX_PROMPT_LENGTH = 500;

    private final RoomRepository roomRepository;
    private final RoomItemRepository roomItemRepository;
    private final RedisFittingDraftStore fittingDraftStore;
    private final ApplicationEventPublisher eventPublisher;

    @BusinessOperation(value = "room.fitting-draft.update", slowThresholdMs = 500)
    @Transactional
    public void update(
            Long roomId,
            Long senderParticipantId,
            FittingDraftUpdateRequestDTO request
    ) {
        ValidatedDraft validated = validateRequest(roomId, request);

        Room room = roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateActive(room);

        if (!Objects.equals(room.getVersion(), request.baseVersion())) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT);
        }

        validateRoomItems(roomId, validated.sizeSelections());

        long nextRevision = request.baseDraftRevision() + 1;
        FittingDraftSnapshotDTO snapshot = new FittingDraftSnapshotDTO(
                nextRevision,
                validated.sizeSelections(),
                validated.wearOptions(),
                validated.prompt()
        );

        Duration ttl = Duration.between(LocalDateTime.now(AppZone.KST), room.getExpiresAt());
        try {
            if (!fittingDraftStore.compareAndSet(
                    roomId,
                    request.baseDraftRevision(),
                    snapshot,
                    ttl
            )) {
                throw new ApiException(ErrorCode.VERSION_CONFLICT);
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ApiException(ErrorCode.DEPENDENCY_UNAVAILABLE);
        }

        eventPublisher.publishEvent(new FittingDraftUpdatedEvent(
                roomId,
                room.getVersion(),
                senderParticipantId,
                request.clientEventId(),
                snapshot
        ));
    }

    private ValidatedDraft validateRequest(Long roomId, FittingDraftUpdateRequestDTO request) {
        if (roomId == null
                || request == null
                || request.clientEventId() == null
                || request.baseVersion() == null
                || request.baseVersion() < 0
                || request.baseDraftRevision() == null
                || request.baseDraftRevision() < 0
                || request.baseDraftRevision() == Long.MAX_VALUE
                || request.data() == null
                || request.data().sizeSelections() == null
                || request.data().wearOptions() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }

        String clientEventId = request.clientEventId().strip();
        if (clientEventId.isEmpty() || clientEventId.length() > MAX_CLIENT_EVENT_ID_LENGTH) {
            throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("field", "clientEventId"));
        }

        List<FittingDraftSizeSelectionDTO> selections = new ArrayList<>();
        Set<Long> uniqueRoomItemIds = new HashSet<>();
        for (FittingDraftSizeSelectionDTO selection : request.data().sizeSelections()) {
            if (selection == null || selection.roomItemId() == null || selection.sizeName() == null) {
                throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("field", "sizeSelections"));
            }
            String sizeName = selection.sizeName().strip();
            if (sizeName.isEmpty()
                    || sizeName.length() > MAX_SIZE_NAME_LENGTH
                    || !uniqueRoomItemIds.add(selection.roomItemId())) {
                throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("field", "sizeSelections"));
            }
            selections.add(new FittingDraftSizeSelectionDTO(selection.roomItemId(), sizeName));
        }

        FittingDraftWearOptionsDTO options = request.data().wearOptions();
        validateEnum(options.topTuck(), TopTuck.class, "wearOptions.topTuck");
        validateEnum(options.outerClosure(), OuterClosure.class, "wearOptions.outerClosure");
        validateEnum(options.sleeves(), Sleeves.class, "wearOptions.sleeves");

        String prompt = request.data().prompt();
        if (prompt != null) {
            prompt = prompt.strip();
            if (prompt.length() > MAX_PROMPT_LENGTH) {
                throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("field", "prompt"));
            }
            if (prompt.isEmpty()) {
                prompt = null;
            }
        }

        return new ValidatedDraft(List.copyOf(selections), options, prompt);
    }

    private void validateRoomItems(Long roomId, List<FittingDraftSizeSelectionDTO> selections) {
        for (FittingDraftSizeSelectionDTO selection : selections) {
            if (!roomItemRepository.existsByIdAndRoomId(selection.roomItemId(), roomId)) {
                throw new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("resource", "roomItem", "roomItemId", selection.roomItemId())
                );
            }
        }
    }

    private <E extends Enum<E>> void validateEnum(String value, Class<E> enumType, String field) {
        if (value == null) {
            return;
        }
        try {
            Enum.valueOf(enumType, value);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("field", field));
        }
    }

    private void validateActive(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        boolean closedStatus = "FINISHED".equals(room.getStatus())
                || "EXPIRED".equals(room.getStatus());
        if (expired || closedStatus) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
    }

    private record ValidatedDraft(
            List<FittingDraftSizeSelectionDTO> sizeSelections,
            FittingDraftWearOptionsDTO wearOptions,
            String prompt
    ) {
    }
}
