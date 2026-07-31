package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO.ItemLockDataDTO;
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

    private RoomItemLockService roomItemLockService;

    private Room room;

    @BeforeEach
    void setUp() {
        roomItemLockService = new RoomItemLockService(roomRepository, roomItemRepository, TTL_MILLIS);
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
        RoomItemLockService shortTtlService =
                new RoomItemLockService(roomRepository, roomItemRepository, -1L); // 즉시 만료
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
}
