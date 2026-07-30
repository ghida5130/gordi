package com.ssafy.backend.websocket;

import com.ssafy.backend.websocket.dto.ItemMovedEventDataDTO;
import com.ssafy.backend.websocket.dto.ParticipantEventDataDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.event.ItemMovedEvent;
import com.ssafy.backend.websocket.event.ParticipantJoinedEvent;
import com.ssafy.backend.websocket.event.RoomEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

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

    // - 인자: 브로드캐스트할 방 이벤트 envelope
    // - 동작: 이벤트의 roomId 토픽으로 STOMP MESSAGE 전송
    public void publish(RoomEventDTO event) {
        messagingTemplate.convertAndSend(
                ROOM_TOPIC_FORMAT.formatted(event.roomId()),
                event
        );
    }
}
