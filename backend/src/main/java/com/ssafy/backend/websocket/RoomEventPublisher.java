package com.ssafy.backend.websocket;

import com.ssafy.backend.websocket.dto.ItemAddedEventDataDTO;
import com.ssafy.backend.websocket.dto.FittingCandidatesUpdatedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemMovedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemRemovedEventDataDTO;
import com.ssafy.backend.websocket.dto.ParticipantEventDataDTO;
import com.ssafy.backend.websocket.dto.ParticipantLeftEventDataDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.dto.RoomStartedEventDataDTO;
import com.ssafy.backend.websocket.dto.TryOnFailedEventDataDTO;
import com.ssafy.backend.websocket.dto.TryOnProcessingEventDataDTO;
import com.ssafy.backend.websocket.dto.TryOnSucceededEventDataDTO;
import com.ssafy.backend.websocket.event.ItemAddedEvent;
import com.ssafy.backend.websocket.event.FittingCandidatesUpdatedEvent;
import com.ssafy.backend.websocket.event.FittingDraftUpdatedEvent;
import com.ssafy.backend.websocket.event.ItemMovedEvent;
import com.ssafy.backend.websocket.event.ItemRemovedEvent;
import com.ssafy.backend.websocket.event.ParticipantJoinedEvent;
import com.ssafy.backend.websocket.event.ParticipantLeftEvent;
import com.ssafy.backend.websocket.event.RoomEventType;
import com.ssafy.backend.websocket.event.RoomExpiredEvent;
import com.ssafy.backend.websocket.event.RoomFinishedEvent;
import com.ssafy.backend.websocket.dto.TierRenamedEventDataDTO;
import com.ssafy.backend.websocket.event.RoomStartedEvent;
import com.ssafy.backend.websocket.event.TierRenamedEvent;
import com.ssafy.backend.websocket.event.TryOnFailedEvent;
import com.ssafy.backend.websocket.event.TryOnProcessingEvent;
import com.ssafy.backend.websocket.event.TryOnSucceededEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

/**
 * 방 이벤트를 /topic/v1/rooms/{roomId}/participants 로 브로드캐스트.
 * 트랜잭션 커밋 후(AFTER_COMMIT)에만 발행하여
 * 롤백된 변경이 클라이언트로 전파되지 않도록 한다.
 */
@Component
@RequiredArgsConstructor
public class RoomEventPublisher {

    private static final String ROOM_TOPIC_FORMAT = "/topic/v1/rooms/%d/participants";

    private final SimpMessagingTemplate messagingTemplate;

    // - 인자: 참여자 입장 도메인 이벤트
    // - 동작: 커밋 후 PARTICIPANT_JOINED 이벤트를 방 토픽으로 브로드캐스트
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleParticipantJoined(ParticipantJoinedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.PARTICIPANT_JOINED,
                null,
                event.roomId(),
                event.roomVersion(),
                event.participantId(),
                new ParticipantEventDataDTO(
                        event.participantId(),
                        event.nickname(),
                        event.role()
                )
        ));
    }

    // - 인자: 명시적 또는 연결 유실로 확정된 참가자 퇴장 이벤트
    // - 동작: 커밋 후 PARTICIPANT_LEFT를 방 토픽으로 브로드캐스트
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleParticipantLeft(ParticipantLeftEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.PARTICIPANT_LEFT,
                event.clientEventId(),
                event.roomId(),
                event.roomVersion(),
                event.participantId(),
                new ParticipantLeftEventDataDTO(event.participantId(), event.reason())
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleItemAdded(ItemAddedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.ITEM_ADDED,
                null,
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new ItemAddedEventDataDTO(event.item(), event.placements())
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleItemRemoved(ItemRemovedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.ITEM_REMOVED,
                null,
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new ItemRemovedEventDataDTO(event.roomItemId(), event.productId())
        ));
    }

    // - 인자: 아이템 이동 도메인 이벤트
    // - 동작: 커밋 후 전체 placements를 담은 ITEM_MOVED 이벤트를 방 토픽으로 브로드캐스트
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleItemMoved(ItemMovedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.ITEM_MOVED,
                event.clientEventId(),
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new ItemMovedEventDataDTO(event.placements())
        ));
    }

    // - 인자: 방 시작 도메인 이벤트
    // - 동작: 커밋 후 ROOM_STARTED 이벤트를 방 토픽으로 브로드캐스트
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleRoomStarted(RoomStartedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.ROOM_STARTED,
                event.clientEventId(),
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new RoomStartedEventDataDTO("IN_PROGRESS")
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleRoomFinished(RoomFinishedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.ROOM_FINISHED,
                null,
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                Map.of()
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleRoomExpired(RoomExpiredEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.ROOM_EXPIRED,
                null,
                event.roomId(),
                event.roomVersion(),
                null,
                Map.of()
        ));
    }

    // - 인자: 티어 이름 변경 도메인 이벤트
    // - 동작: 커밋 후 TIER_RENAMED 이벤트를 방 토픽으로 브로드캐스트
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTierRenamed(TierRenamedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.TIER_RENAMED,
                event.clientEventId(),
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new TierRenamedEventDataDTO(event.tierId(), event.name())
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleFittingCandidatesUpdated(FittingCandidatesUpdatedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.FITTING_CANDIDATES_UPDATED,
                event.clientEventId(),
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new FittingCandidatesUpdatedEventDataDTO(event.fittingCandidates())
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleFittingDraftUpdated(FittingDraftUpdatedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.FITTING_DRAFT_UPDATED,
                event.clientEventId(),
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                event.draft()
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTryOnProcessing(TryOnProcessingEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.TRY_ON_PROCESSING,
                null,
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new TryOnProcessingEventDataDTO(event.jobId())
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTryOnSucceeded(TryOnSucceededEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.TRY_ON_SUCCEEDED,
                null,
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new TryOnSucceededEventDataDTO(event.jobId(), event.resultImageUrl())
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTryOnFailed(TryOnFailedEvent event) {
        publish(RoomEventDTO.of(
                RoomEventType.TRY_ON_FAILED,
                null,
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new TryOnFailedEventDataDTO(event.jobId(), event.reason())
        ));
    }

    // - 인자: 브로드캐스트할 방 이벤트 envelope
    // - 동작: 이벤트의 roomId 토픽으로 STOMP MESSAGE 전송
    public void publish(RoomEventDTO event) {
        messagingTemplate.convertAndSend(
                ROOM_TOPIC_FORMAT.formatted(event.roomId()),
                event
        );
    }
}
