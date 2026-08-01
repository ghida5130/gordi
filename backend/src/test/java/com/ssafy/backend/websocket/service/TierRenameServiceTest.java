package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.websocket.dto.TierRenameRequestDTO;
import com.ssafy.backend.websocket.dto.TierRenameRequestDTO.TierRenameDataDTO;
import com.ssafy.backend.websocket.event.TierRenamedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TierRenameServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private TierRepository tierRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private TierRenameService tierRenameService;

    private Room room;
    private Tier tier;

    @BeforeEach
    void setUp() {
        room = Room.builder()
                .id(31L)
                .status("IN_PROGRESS")
                .version(12L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
        tier = Tier.builder().id(1L).room(room).name("S").position(0).build();
    }

    private TierRenameRequestDTO request(long tierId, String name) {
        return new TierRenameRequestDTO(
                "request-uuid",
                12L,
                new TierRenameDataDTO(tierId, name)
        );
    }

    @Test
    void HOST가_요청하면_이름을_바꾸고_TIER_RENAMED_이벤트를_발행한다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(tierRepository.findById(1L)).thenReturn(Optional.of(tier));
        when(roomRepository.bumpVersionIfMatches(31L, 12L)).thenReturn(1);

        tierRenameService.rename(31L, 42L, "HOST", request(1L, "  BEST  "));

        assertThat(tier.getName()).isEqualTo("BEST"); // 공백 정규화

        ArgumentCaptor<TierRenamedEvent> captor = ArgumentCaptor.forClass(TierRenamedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());

        TierRenamedEvent event = captor.getValue();
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.roomVersion()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.tierId()).isEqualTo(1L);
        assertThat(event.name()).isEqualTo("BEST");
    }

    @Test
    void HOST가_아니면_FORBIDDEN을_던진다() {
        assertThatThrownBy(() -> tierRenameService.rename(31L, 42L, "PARTICIPANTS", request(1L, "BEST")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);

        verify(roomRepository, never()).bumpVersionIfMatches(anyLong(), anyLong());
    }

    @Test
    void 다른_방의_티어면_RESOURCE_NOT_FOUND를_던진다() {
        Room otherRoom = Room.builder()
                .id(99L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
        Tier otherTier = Tier.builder().id(7L).room(otherRoom).name("X").position(0).build();

        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(tierRepository.findById(7L)).thenReturn(Optional.of(otherTier));

        assertThatThrownBy(() -> tierRenameService.rename(31L, 42L, "HOST", request(7L, "BEST")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);

        verify(roomRepository, never()).bumpVersionIfMatches(anyLong(), anyLong());
    }

    @Test
    void baseVersion이_다르면_VERSION_CONFLICT를_던지고_이름을_바꾸지_않는다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(tierRepository.findById(1L)).thenReturn(Optional.of(tier));
        when(roomRepository.bumpVersionIfMatches(31L, 12L)).thenReturn(0);

        assertThatThrownBy(() -> tierRenameService.rename(31L, 42L, "HOST", request(1L, "BEST")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);

        assertThat(tier.getName()).isEqualTo("S");
        verify(eventPublisher, never()).publishEvent(any(TierRenamedEvent.class));
    }

    @Test
    void 종료된_방이면_ROOM_CLOSED를_던진다() {
        Room finishedRoom = Room.builder()
                .id(31L)
                .status("FINISHED")
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
        when(roomRepository.findById(31L)).thenReturn(Optional.of(finishedRoom));

        assertThatThrownBy(() -> tierRenameService.rename(31L, 42L, "HOST", request(1L, "BEST")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_CLOSED);
    }

    @Test
    void 이름이_공백이거나_100자를_넘으면_BAD_REQUEST를_던진다() {
        assertThatThrownBy(() -> tierRenameService.rename(31L, 42L, "HOST", request(1L, "   ")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);

        assertThatThrownBy(() -> tierRenameService.rename(31L, 42L, "HOST", request(1L, "가".repeat(101))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }
}
