package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.RoomEventPublisher;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO.ItemLockDataDTO;
import com.ssafy.backend.websocket.dto.ItemUnlockRequestDTO;
import com.ssafy.backend.websocket.dto.ItemUnlockRequestDTO.ItemUnlockDataDTO;
import com.ssafy.backend.websocket.dto.ItemUnlockedEventDataDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.event.ItemUnlockReason;
import com.ssafy.backend.websocket.event.ItemUnlockRequestedEvent;
import com.ssafy.backend.websocket.event.ParticipantLeaveReason;
import com.ssafy.backend.websocket.event.ParticipantLeftEvent;
import com.ssafy.backend.websocket.event.RoomEventType;
import com.ssafy.backend.websocket.service.RoomItemLockService.ItemLockResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomItemLockServiceTest {

    private static final long TTL_MILLIS = 30_000L;

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private RoomEventPublisher roomEventPublisher;

    private RoomItemLockService roomItemLockService;

    private Room room;

    @BeforeEach
    void setUp() {
        roomItemLockService = new RoomItemLockService(
                roomRepository, roomItemRepository, roomEventPublisher, TTL_MILLIS);
        room = Room.builder()
                .id(31L)
                .status("IN_PROGRESS")
                .version(12L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
    }

    private ItemLockRequestDTO request(long roomItemId, String lockToken) {
        return new ItemLockRequestDTO("request-uuid", new ItemLockDataDTO(roomItemId, lockToken));
    }

    private void stubValidRoomAndItem() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.existsByIdAndRoomId(91L, 31L)).thenReturn(true);
    }

    @Test
    void 잠금이_없으면_획득에_성공하고_방_버전을_그대로_반환한다() {
        stubValidRoomAndItem();

        ItemLockResult result = roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        assertThat(result.acquired()).isTrue();
        assertThat(result.roomVersion()).isEqualTo(12L); // 버전 증가 없음
        assertThat(result.owner().participantId()).isEqualTo(42L);
        assertThat(result.owner().nickname()).isEqualTo("철수");
        assertThat(result.owner().lockToken()).isEqualTo("token-1");
    }

    @Test
    void 다른_참여자가_보유_중이면_거절하고_보유자_정보를_반환한다() {
        stubValidRoomAndItem();
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        ItemLockResult result = roomItemLockService.tryLock(31L, 50L, "영희", request(91L, "token-2"));

        assertThat(result.acquired()).isFalse();
        assertThat(result.owner().participantId()).isEqualTo(42L);
        assertThat(result.owner().nickname()).isEqualTo("철수");
    }

    @Test
    void 같은_참여자의_재요청은_성공하고_lockToken을_갱신한다() {
        stubValidRoomAndItem();
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        ItemLockResult result = roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-2"));

        assertThat(result.acquired()).isTrue();
        assertThat(result.owner().lockToken()).isEqualTo("token-2");
    }

    @Test
    void TTL이_지난_잠금은_새_요청이_획득한다() {
        RoomItemLockService shortTtlService = new RoomItemLockService(
                roomRepository, roomItemRepository, roomEventPublisher, -1L); // 즉시 만료
        stubValidRoomAndItem();
        shortTtlService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        ItemLockResult result = shortTtlService.tryLock(31L, 50L, "영희", request(91L, "token-2"));

        assertThat(result.acquired()).isTrue();
        assertThat(result.owner().participantId()).isEqualTo(50L);
    }

    @Test
    void 다른_아이템의_잠금은_서로_영향을_주지_않는다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.existsByIdAndRoomId(91L, 31L)).thenReturn(true);
        when(roomItemRepository.existsByIdAndRoomId(92L, 31L)).thenReturn(true);
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        ItemLockResult result = roomItemLockService.tryLock(31L, 50L, "영희", request(92L, "token-2"));

        assertThat(result.acquired()).isTrue();
    }

    @Test
    void 방에_없는_아이템이면_RESOURCE_NOT_FOUND를_던진다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.existsByIdAndRoomId(91L, 31L)).thenReturn(false);

        assertThatThrownBy(() -> roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    void lockToken이_없으면_BAD_REQUEST를_던진다() {
        assertThatThrownBy(() -> roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "  ")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    private ItemUnlockRequestedEvent unlockRequest(long participantId, String lockToken) {
        return new ItemUnlockRequestedEvent(
                31L, 13L, participantId, "request-uuid", 91L, lockToken,
                ItemUnlockReason.MOVE_COMPLETED
        );
    }

    @Test
    void 소유자와_토큰이_일치하면_잠금을_해제하고_ITEM_UNLOCKED를_방송한다() {
        stubValidRoomAndItem();
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        roomItemLockService.handleUnlockRequested(unlockRequest(42L, "token-1"));

        org.mockito.ArgumentCaptor<RoomEventDTO> captor =
                org.mockito.ArgumentCaptor.forClass(RoomEventDTO.class);
        org.mockito.Mockito.verify(roomEventPublisher).publish(captor.capture());

        RoomEventDTO event = captor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ITEM_UNLOCKED);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.version()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(
                new ItemUnlockedEventDataDTO(91L, ItemUnlockReason.MOVE_COMPLETED)
        );

        // 해제됐으므로 다른 참여자가 즉시 획득 가능
        ItemLockResult result = roomItemLockService.tryLock(31L, 50L, "영희", request(91L, "token-2"));
        assertThat(result.acquired()).isTrue();
    }

    @Test
    void 토큰이_다르면_해제하지_않고_방송도_하지_않는다() {
        stubValidRoomAndItem();
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        roomItemLockService.handleUnlockRequested(unlockRequest(42L, "wrong-token"));

        org.mockito.Mockito.verify(roomEventPublisher, org.mockito.Mockito.never())
                .publish(org.mockito.ArgumentMatchers.any());
        // 잠금 유지 → 다른 참여자는 여전히 거절
        ItemLockResult result = roomItemLockService.tryLock(31L, 50L, "영희", request(91L, "token-2"));
        assertThat(result.acquired()).isFalse();
    }

    @Test
    void isLockedByOther는_타인의_유효한_잠금만_true를_반환한다() {
        stubValidRoomAndItem();
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        assertThat(roomItemLockService.isLockedByOther(31L, 91L, 50L)).isTrue();  // 타인
        assertThat(roomItemLockService.isLockedByOther(31L, 91L, 42L)).isFalse(); // 본인
        assertThat(roomItemLockService.isLockedByOther(31L, 92L, 50L)).isFalse(); // 잠금 없음
    }

    private ItemUnlockRequestDTO manualUnlockRequest(String lockToken) {
        return new ItemUnlockRequestDTO(
                "unlock-request-uuid",
                new ItemUnlockDataDTO(91L, lockToken, ItemUnlockReason.CANCELLED)
        );
    }

    @Test
    void 수동_해제_성공_시_요청_reason으로_ITEM_UNLOCKED를_방송한다() {
        stubValidRoomAndItem();
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        boolean released = roomItemLockService.unlock(31L, 42L, manualUnlockRequest("token-1"));

        assertThat(released).isTrue();
        org.mockito.ArgumentCaptor<RoomEventDTO> captor =
                org.mockito.ArgumentCaptor.forClass(RoomEventDTO.class);
        org.mockito.Mockito.verify(roomEventPublisher).publish(captor.capture());

        RoomEventDTO event = captor.getValue();
        assertThat(event.eventType()).isEqualTo(RoomEventType.ITEM_UNLOCKED);
        assertThat(event.clientEventId()).isEqualTo("unlock-request-uuid");
        assertThat(event.version()).isEqualTo(12L); // 버전 증가 없음
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.data()).isEqualTo(
                new ItemUnlockedEventDataDTO(91L, ItemUnlockReason.CANCELLED)
        );
    }

    @Test
    void 늦게_도착한_이전_드래그의_unlock은_새_잠금을_해제하지_못한다() {
        stubValidRoomAndItem();
        // 철수의 이전 드래그(token-old) → 이동 완료로 해제 → 영희가 새로 잠금(token-new)
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-old"));
        roomItemLockService.releaseIfOwnedBy(31L, 91L, 42L, "token-old");
        roomItemLockService.tryLock(31L, 50L, "영희", request(91L, "token-new"));

        // 철수의 늦은 unlock(token-old) 도착
        boolean released = roomItemLockService.unlock(31L, 42L, manualUnlockRequest("token-old"));

        assertThat(released).isFalse();
        org.mockito.Mockito.verify(roomEventPublisher, org.mockito.Mockito.never())
                .publish(org.mockito.ArgumentMatchers.any());
        // 영희의 잠금은 그대로 유지
        assertThat(roomItemLockService.isLockedByOther(31L, 91L, 42L)).isTrue();
    }

    @Test
    void unlock_요청에_lockToken이_없으면_BAD_REQUEST를_던진다() {
        assertThatThrownBy(() -> roomItemLockService.unlock(31L, 42L, manualUnlockRequest("  ")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void 종료된_방이면_ROOM_CLOSED를_던진다() {
        Room finishedRoom = Room.builder()
                .id(31L)
                .status("FINISHED")
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
        when(roomRepository.findById(31L)).thenReturn(Optional.of(finishedRoom));

        assertThatThrownBy(() -> roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_CLOSED);
    }

    @Test
    void 참가자_퇴장_커밋_후_해당_참가자의_모든_잠금을_정리한다() {
        stubValidRoomAndItem();
        roomItemLockService.tryLock(31L, 42L, "철수", request(91L, "token-1"));

        roomItemLockService.handleParticipantLeft(new ParticipantLeftEvent(
                31L, 12L, 42L, "request-uuid", ParticipantLeaveReason.USER_REQUEST));

        ItemLockResult result = roomItemLockService.tryLock(
                31L, 50L, "영희", request(91L, "token-2"));
        assertThat(result.acquired()).isTrue();
    }
}
