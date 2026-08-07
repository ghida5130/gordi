package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.infra.RedisFittingDraftStore;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.websocket.dto.BoardSnapshotDataDTO;
import com.ssafy.backend.websocket.dto.FittingCandidateDTO;
import com.ssafy.backend.websocket.dto.FittingDraftSizeSelectionDTO;
import com.ssafy.backend.websocket.dto.FittingDraftSnapshotDTO;
import com.ssafy.backend.websocket.dto.FittingDraftWearOptionsDTO;
import com.ssafy.backend.websocket.dto.ItemSnapshotDTO;
import com.ssafy.backend.websocket.dto.ParticipantEventDataDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.dto.TierSnapshotDTO;
import com.ssafy.backend.websocket.event.RoomEventType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomSyncServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomParticipantRepository roomParticipantRepository;
    @Mock
    private TierRepository tierRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private RedisFittingDraftStore fittingDraftStore;

    @InjectMocks
    private RoomSyncService roomSyncService;

    private Room room(long id, long version, String status) {
        Room room = mock(Room.class);
        when(room.getVersion()).thenReturn(version);
        when(room.getStatus()).thenReturn(status);
        return room;
    }

    private RoomParticipant participant(long id, String nickname, String role) {
        RoomParticipant participant = mock(RoomParticipant.class);
        when(participant.getId()).thenReturn(id);
        when(participant.getNickname()).thenReturn(nickname);
        when(participant.getRole()).thenReturn(role);
        return participant;
    }

    private Tier tier(long id, String name, int position) {
        Tier tier = mock(Tier.class);
        when(tier.getId()).thenReturn(id);
        when(tier.getName()).thenReturn(name);
        when(tier.getPosition()).thenReturn(position);
        return tier;
    }

    private RoomItem item(long id, long productId, Tier tier, int position) {
        RoomItem item = mock(RoomItem.class);
        Product product = mock(Product.class);
        when(product.getId()).thenReturn(productId);
        when(item.getId()).thenReturn(id);
        when(item.getProduct()).thenReturn(product);
        when(item.getTier()).thenReturn(tier);
        when(item.getPosition()).thenReturn(position);
        return item;
    }

    @Test
    void 방_전체_스냅샷을_BOARD_SNAPSHOT_envelope로_조립한다() {
        // 1. Mock 객체를 먼저 생성
        Tier tierS = tier(1L, "S", 0);
        Tier tierA = tier(2L, "A", 1);

        Room mockRoom = room(31L, 14L, "IN_PROGRESS");
        RoomParticipant host = participant(42L, "홍길동", "HOST");

        RoomItem item1 = item(30L, 100L, tierS, 0);
        RoomItem item2 = item(40L, 200L, null, 1);
        when(item1.isFittingCandidate()).thenReturn(true);

        // 2. 생성된 Mock 객체로 Repository 스터빙
        when(roomRepository.findById(31L))
                .thenReturn(Optional.of(mockRoom));

        when(roomParticipantRepository
                .findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(31L))
                .thenReturn(List.of(host));

        when(tierRepository.findAllByRoomIdOrderByPositionAsc(31L))
                .thenReturn(List.of(tierS, tierA));

        when(roomItemRepository.findAllByRoomIdWithProduct(31L))
                .thenReturn(List.of(item1, item2));
        FittingDraftSnapshotDTO fittingDraft = new FittingDraftSnapshotDTO(
                4L,
                List.of(new FittingDraftSizeSelectionDTO(30L, "M")),
                new FittingDraftWearOptionsDTO("UNTUCKED", null, "ROLLED"),
                "소매를 한 번 접어주세요"
        );
        when(fittingDraftStore.findByRoomId(31L)).thenReturn(Optional.of(fittingDraft));

        RoomEventDTO snapshot = roomSyncService.buildSnapshot(31L, "request-uuid", 42L);

        assertThat(snapshot.eventId()).isNotBlank();
        assertThat(snapshot.clientEventId()).isEqualTo("request-uuid");
        assertThat(snapshot.eventType()).isEqualTo(RoomEventType.BOARD_SNAPSHOT);
        assertThat(snapshot.roomId()).isEqualTo(31L);
        assertThat(snapshot.version()).isEqualTo(14L);
        assertThat(snapshot.senderParticipantId()).isEqualTo(42L);

        BoardSnapshotDataDTO data = (BoardSnapshotDataDTO) snapshot.data();
        assertThat(data.status()).isEqualTo("IN_PROGRESS");
        assertThat(data.participants()).containsExactly(
                new ParticipantEventDataDTO(42L, "홍길동", "HOST")
        );
        assertThat(data.tiers()).containsExactly(
                new TierSnapshotDTO(1L, "S", 0, List.of(new ItemSnapshotDTO(30L, 100L, 0))),
                new TierSnapshotDTO(2L, "A", 1, List.of())
        );
        assertThat(data.unclassifiedItems()).containsExactly(
                new ItemSnapshotDTO(40L, 200L, 1)
        );
        assertThat(data.fittingCandidates()).containsExactly(
                new FittingCandidateDTO(30L)
        );
        assertThat(data.fittingDraft()).isEqualTo(fittingDraft);
    }

    @Test
    void 방이_없으면_ROOM_NOT_FOUND_예외를_던진다() {
        when(roomRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> roomSyncService.buildSnapshot(99L, null, 42L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_NOT_FOUND);
    }
}
