package com.ssafy.backend.websocket;

import com.ssafy.backend.websocket.dto.ItemMovedEventDataDTO;
import com.ssafy.backend.websocket.dto.ParticipantEventDataDTO;
import com.ssafy.backend.websocket.dto.PlacementDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.dto.RoomStartedEventDataDTO;
import com.ssafy.backend.websocket.event.ItemMovedEvent;
import com.ssafy.backend.websocket.event.ParticipantJoinedEvent;
import com.ssafy.backend.websocket.event.RoomEventType;
import com.ssafy.backend.websocket.event.RoomFinishedEvent;
import com.ssafy.backend.websocket.dto.TierRenamedEventDataDTO;
import com.ssafy.backend.websocket.event.RoomStartedEvent;
import com.ssafy.backend.websocket.event.TierRenamedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RoomEventPublisherTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private RoomEventPublisher roomEventPublisher;

    @Test
    void 참여자_입장_이벤트를_방_토픽으로_브로드캐스트한다() {
        ParticipantJoinedEvent domainEvent = new ParticipantJoinedEvent(
                31L,
                13L,
                42L,
                "친구1",
                "PARTICIPANTS"
        );

        roomEventPublisher.handleParticipantJoined(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventId()).isNotBlank();
        assertThat(event.clientEventId()).isNull();
        assertThat(event.eventType()).isEqualTo(RoomEventType.PARTICIPANT_JOINED);
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.version()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(
                new ParticipantEventDataDTO(42L, "친구1", "PARTICIPANTS")
        );
    }

    @Test
    void 아이템_이동_이벤트를_전체_placements와_함께_브로드캐스트한다() {
        ItemMovedEvent domainEvent = new ItemMovedEvent(
                31L,
                13L,
                42L,
                "request-uuid",
                List.of(
                        new PlacementDTO(30L, 1L, 10_000),
                        new PlacementDTO(20L, null, 10_000)
                )
        );

        roomEventPublisher.handleItemMoved(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ITEM_MOVED);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.version()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new ItemMovedEventDataDTO(domainEvent.placements()));
    }

    @Test
    void 방_시작_이벤트를_IN_PROGRESS_상태와_함께_브로드캐스트한다() {
        RoomStartedEvent domainEvent = new RoomStartedEvent(31L, 13L, 42L, "request-uuid");

        roomEventPublisher.handleRoomStarted(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ROOM_STARTED);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.version()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new RoomStartedEventDataDTO("IN_PROGRESS"));
    }

    @Test
    void 티어_이름_변경_이벤트를_브로드캐스트한다() {
        TierRenamedEvent domainEvent = new TierRenamedEvent(31L, 13L, 42L, "request-uuid", 3L, "S급");

        roomEventPublisher.handleTierRenamed(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.TIER_RENAMED);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.version()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new TierRenamedEventDataDTO(3L, "S급"));
    }

    @Test
    void 발행_시_이벤트의_roomId로_토픽_경로를_만든다() {
        RoomEventDTO event = RoomEventDTO.of(
                RoomEventType.ROOM_STARTED,
                "client-uuid",
                7L,
                1L,
                42L,
                null
        );

        roomEventPublisher.publish(event);

        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/7/participants"),
                eq(event)
        );
    }

    @Test
    void roomFinishedEventIsBroadcast() {
        RoomFinishedEvent domainEvent = new RoomFinishedEvent(31L, 18L, 42L);

        roomEventPublisher.handleRoomFinished(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ROOM_FINISHED);
        assertThat(event.version()).isEqualTo(18L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(Map.of());
    }
}
