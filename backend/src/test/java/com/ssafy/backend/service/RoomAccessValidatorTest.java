package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoomAccessValidatorTest {

    private RoomParticipantRepository roomParticipantRepository;
    private RoomAccessValidator roomAccessValidator;

    @BeforeEach
    void setUp() {
        roomParticipantRepository = mock(RoomParticipantRepository.class);
        roomAccessValidator = new RoomAccessValidator(roomParticipantRepository);
    }

    @Test
    void 같은_방의_활성_참가자이면_참가자를_반환한다() {
        RoomPrincipal principal = principal(31L);
        RoomParticipant participant = mock(RoomParticipant.class);
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(participant));

        RoomParticipant result = roomAccessValidator.requireParticipant(31L, principal);

        assertThat(result).isSameAs(participant);
    }

    @Test
    void 토큰의_방과_요청_방이_다르면_FORBIDDEN을_던진다() {
        RoomPrincipal principal = principal(31L);

        assertThatThrownBy(() -> roomAccessValidator.requireParticipant(32L, principal))
                .isInstanceOfSatisfying(ApiException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
        verify(roomParticipantRepository, never())
                .findByIdAndRoomIdAndLeftAtIsNull(42L, 32L);
    }

    @Test
    void 활성_참가자가_아니면_FORBIDDEN을_던진다() {
        RoomPrincipal principal = principal(31L);
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> roomAccessValidator.requireParticipant(31L, principal))
                .isInstanceOfSatisfying(ApiException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    void 회원이_해당_방의_활성_참가자이면_참가자를_반환한다() {
        RoomParticipant participant = mock(RoomParticipant.class);
        when(roomParticipantRepository.findByRoomIdAndUserEmailAndLeftAtIsNull(
                31L,
                "member@example.com"
        )).thenReturn(Optional.of(participant));

        RoomParticipant result = roomAccessValidator.requireParticipant(
                31L,
                "member@example.com"
        );

        assertThat(result).isSameAs(participant);
    }

    @Test
    void 회원이_해당_방의_활성_참가자가_아니면_FORBIDDEN을_던진다() {
        when(roomParticipantRepository.findByRoomIdAndUserEmailAndLeftAtIsNull(
                31L,
                "member@example.com"
        )).thenReturn(Optional.empty());

        assertThatThrownBy(() -> roomAccessValidator.requireParticipant(
                31L,
                "member@example.com"
        )).isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }

    private RoomPrincipal principal(Long roomId) {
        return new RoomPrincipal(42L, roomId, "친구1", "PARTICIPANTS");
    }
}
