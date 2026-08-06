package com.ssafy.backend.websocket;

import com.ssafy.backend.dto.candidate.CandidateItemDTO;
import com.ssafy.backend.websocket.dto.FittingCandidateDTO;
import com.ssafy.backend.websocket.dto.FittingCandidatesUpdatedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemAddedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemMovedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemRemovedEventDataDTO;
import com.ssafy.backend.websocket.dto.ParticipantEventDataDTO;
import com.ssafy.backend.websocket.dto.ParticipantLeftEventDataDTO;
import com.ssafy.backend.websocket.dto.PlacementDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.dto.RoomStartedEventDataDTO;
import com.ssafy.backend.websocket.dto.TryOnFailedEventDataDTO;
import com.ssafy.backend.websocket.dto.TryOnProcessingEventDataDTO;
import com.ssafy.backend.websocket.dto.TryOnSucceededEventDataDTO;
import com.ssafy.backend.websocket.event.ItemAddedEvent;
import com.ssafy.backend.websocket.event.FittingCandidatesUpdatedEvent;
import com.ssafy.backend.websocket.event.ItemMovedEvent;
import com.ssafy.backend.websocket.event.ItemRemovedEvent;
import com.ssafy.backend.websocket.event.ParticipantJoinedEvent;
import com.ssafy.backend.websocket.event.ParticipantLeaveReason;
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
    void 참여자_퇴장_이벤트를_reason과_함께_방_토픽으로_브로드캐스트한다() {
        ParticipantLeftEvent domainEvent = new ParticipantLeftEvent(
                31L,
                13L,
                42L,
                "request-uuid",
                ParticipantLeaveReason.USER_REQUEST
        );

        roomEventPublisher.handleParticipantLeft(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.PARTICIPANT_LEFT);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.version()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new ParticipantLeftEventDataDTO(
                42L, ParticipantLeaveReason.USER_REQUEST));
    }

    @Test
    void 아이템_추가시_위치_브로드캐스트() {
        CandidateItemDTO item = new CandidateItemDTO(
                301L,
                501L,
                "오버핏 시어커튼 셔츠",
                "MUSINSA STANDARD",
                39_900,
                "https://cdn.example.com/products/501.jpg",
                10_000,
                null
        );
        ItemAddedEvent domainEvent = new ItemAddedEvent(
                31L,
                13L,
                42L,
                item,
                List.of(
                        new PlacementDTO(301L, null, 10_000),
                        new PlacementDTO(201L, null, 20_000)
                )
        );

        roomEventPublisher.handleItemAdded(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ITEM_ADDED);
        assertThat(event.clientEventId()).isNull();
        assertThat(event.version()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(
                new ItemAddedEventDataDTO(item, domainEvent.placements())
        );
    }

    @Test
    void itemRemovedEventIsBroadcastWithRemovedItemIds() {
        ItemRemovedEvent domainEvent = new ItemRemovedEvent(
                31L,
                15L,
                42L,
                301L,
                501L
        );

        roomEventPublisher.handleItemRemoved(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ITEM_REMOVED);
        assertThat(event.clientEventId()).isNull();
        assertThat(event.version()).isEqualTo(15L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new ItemRemovedEventDataDTO(301L, 501L));
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
    void 피팅_후보_전체_배열을_브로드캐스트한다() {
        FittingCandidatesUpdatedEvent domainEvent = new FittingCandidatesUpdatedEvent(
                31L,
                17L,
                42L,
                "request-uuid",
                List.of(new FittingCandidateDTO(301L), new FittingCandidateDTO(305L))
        );

        roomEventPublisher.handleFittingCandidatesUpdated(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.FITTING_CANDIDATES_UPDATED);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.version()).isEqualTo(17L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new FittingCandidatesUpdatedEventDataDTO(
                domainEvent.fittingCandidates()
        ));
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

    @Test
    void roomExpiredEventIsBroadcast() {
        RoomExpiredEvent domainEvent = new RoomExpiredEvent(31L, 19L);

        roomEventPublisher.handleRoomExpired(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ROOM_EXPIRED);
        assertThat(event.version()).isEqualTo(19L);
        assertThat(event.senderParticipantId()).isNull();
        assertThat(event.data()).isEqualTo(Map.of());
    }

    @Test
    void tryOnProcessingEventIsBroadcastWithJobId() {
        TryOnProcessingEvent domainEvent = new TryOnProcessingEvent(31L, 17L, 42L, 11L);

        roomEventPublisher.handleTryOnProcessing(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.TRY_ON_PROCESSING);
        assertThat(event.clientEventId()).isNull();
        assertThat(event.version()).isEqualTo(17L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new TryOnProcessingEventDataDTO(11L));
    }

    @Test
    void tryOnSucceededEventIsBroadcastWithJobIdAndResultImageUrl() {
        TryOnSucceededEvent domainEvent = new TryOnSucceededEvent(
                31L,
                17L,
                42L,
                11L,
                "https://cdn.example.com/fittings/11.webp"
        );

        roomEventPublisher.handleTryOnSucceeded(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.TRY_ON_SUCCEEDED);
        assertThat(event.clientEventId()).isNull();
        assertThat(event.version()).isEqualTo(17L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new TryOnSucceededEventDataDTO(
                11L,
                "https://cdn.example.com/fittings/11.webp"
        ));
    }

    @Test
    void tryOnFailedEventIsBroadcastWithJobIdAndReason() {
        TryOnFailedEvent domainEvent = new TryOnFailedEvent(
                31L,
                17L,
                42L,
                11L,
                "착장 이미지를 생성하지 못했습니다."
        );

        roomEventPublisher.handleTryOnFailed(domainEvent);

        ArgumentCaptor<RoomEventDTO> eventCaptor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/participants"),
                eventCaptor.capture()
        );

        RoomEventDTO event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.TRY_ON_FAILED);
        assertThat(event.clientEventId()).isNull();
        assertThat(event.version()).isEqualTo(17L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new TryOnFailedEventDataDTO(
                11L,
                "착장 이미지를 생성하지 못했습니다."
        ));
    }
}
