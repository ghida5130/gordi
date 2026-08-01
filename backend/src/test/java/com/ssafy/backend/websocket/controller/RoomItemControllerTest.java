package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.websocket.RoomEventPublisher;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.ItemLockRejectedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO.ItemLockDataDTO;
import com.ssafy.backend.websocket.dto.ItemLockedEventDataDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.event.RoomEventType;
import com.ssafy.backend.websocket.service.RoomItemLockService;
import com.ssafy.backend.websocket.service.RoomItemLockService.ItemLock;
import com.ssafy.backend.websocket.service.RoomItemLockService.ItemLockResult;
import com.ssafy.backend.websocket.service.RoomItemMoveService;
import com.ssafy.backend.websocket.service.RoomSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomItemControllerTest {

    @Mock
    private RoomItemMoveService roomItemMoveService;
    @Mock
    private RoomItemLockService roomItemLockService;
    @Mock
    private RoomSyncService roomSyncService;
    @Mock
    private RoomEventPublisher roomEventPublisher;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private RoomItemController roomItemController;

    private RoomPrincipal principal() {
        return new RoomPrincipal(42L, 31L, "철수", "PARTICIPANTS");
    }

    private ItemLockRequestDTO lockRequest() {
        return new ItemLockRequestDTO("request-uuid", new ItemLockDataDTO(91L, "token-1"));
    }

    @Test
    void 잠금_성공_시_lockToken_없이_ITEM_LOCKED를_방_토픽으로_브로드캐스트한다() {
        when(roomItemLockService.tryLock(eq(31L), eq(42L), eq("철수"), any()))
                .thenReturn(new ItemLockResult(
                        true, 12L, new ItemLock(42L, "철수", "token-1", 0L)
                ));

        roomItemController.lockItem(31L, lockRequest(), principal());

        ArgumentCaptor<RoomEventDTO> captor = ArgumentCaptor.forClass(RoomEventDTO.class);
        verify(roomEventPublisher).publish(captor.capture());

        RoomEventDTO event = captor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ITEM_LOCKED);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.version()).isEqualTo(12L); // 버전 증가 없음
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(new ItemLockedEventDataDTO(91L, 42L, "철수"));

        verify(messagingTemplate, never())
                .convertAndSendToUser(anyString(), anyString(), any(Object.class));
    }

    @Test
    void 잠금_거절_시_ITEM_LOCK_REJECTED를_요청자_개인_큐로만_보낸다() {
        when(roomItemLockService.tryLock(eq(31L), eq(42L), eq("철수"), any()))
                .thenReturn(new ItemLockResult(
                        false, 12L, new ItemLock(50L, "영희", "other-token", 0L)
                ));

        roomItemController.lockItem(31L, lockRequest(), principal());

        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate).convertAndSendToUser(
                eq("42"), eq("/queue/item-locks"), captor.capture());

        RoomEventDTO event = (RoomEventDTO) captor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ITEM_LOCK_REJECTED);
        assertThat(event.senderParticipantId()).isEqualTo(42L); // 요청자
        assertThat(event.data()).isEqualTo(
                new ItemLockRejectedEventDataDTO(91L, "ITEM_ALREADY_LOCKED", 50L, "영희")
        );

        verify(roomEventPublisher, never()).publish(any());
    }

    @Test
    void 다른_방_잠금_요청은_무시한다() {
        roomItemController.lockItem(99L, lockRequest(), principal());

        verify(roomItemLockService, never()).tryLock(anyLong(), anyLong(), anyString(), any());
        verify(roomEventPublisher, never()).publish(any());
    }
}
