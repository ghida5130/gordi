package com.ssafy.backend.websocket;

import com.ssafy.backend.websocket.dto.ParticipantEventDataDTO;
import com.ssafy.backend.websocket.event.ParticipantJoinedEvent;
import com.ssafy.backend.websocket.event.RoomEventType;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

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
}
