package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.dto.room.VoiceTokenResponseDTO;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.util.LivekitTokenProvider;
import com.ssafy.backend.websocket.RoomPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoiceTokenServiceTest {

    private static final String SERVER_URL = "ws://localhost:7880";
    private static final String ROOM_NAME_PREFIX = "gordi-room-";

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomParticipantRepository roomParticipantRepository;
    @Mock
    private LivekitTokenProvider livekitTokenProvider;

    private VoiceTokenService voiceTokenService;

    @BeforeEach
    void setUp() {
        voiceTokenService = new VoiceTokenService(
                roomRepository,
                roomParticipantRepository,
                livekitTokenProvider,
                SERVER_URL,
                ROOM_NAME_PREFIX
        );
    }

    private Room room(Long id, String status) {
        return Room.builder()
                .id(id)
                .roomCode("ABC234")
                .status(status)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(1))
                .build();
    }

    private RoomPrincipal principal(Long participantId, Long roomId) {
        return new RoomPrincipal(participantId, roomId, "친구1", "PARTICIPANTS");
    }

    @Test
    void 음성_토큰_발급_성공_테스트() {
        Room room = room(31L, "IN_PROGRESS");
        when(roomRepository.findByRoomCode("ABC234")).thenReturn(Optional.of(room));
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(RoomParticipant.builder().id(42L).room(room).nickname("친구1").build()));
        Instant expiresAt = Instant.now().plusSeconds(600);
        when(livekitTokenProvider.createParticipantToken(
                eq(42L), eq("친구1"), eq("gordi-room-31"), any(LocalDateTime.class)))
                .thenReturn(new LivekitTokenProvider.IssuedToken("livekit-jwt", expiresAt));

        VoiceTokenResponseDTO response = voiceTokenService.issue("abc234", principal(42L, 31L));

        assertThat(response.serverUrl()).isEqualTo(SERVER_URL);
        assertThat(response.participantToken()).isEqualTo("livekit-jwt");
        assertThat(response.expiresAt()).isEqualTo(expiresAt);
    }

    @Test
    void 다른_방의_roomToken이면_FORBIDDEN() {
        when(roomRepository.findByRoomCode("ABC234"))
                .thenReturn(Optional.of(room(31L, "IN_PROGRESS")));

        assertThatThrownBy(() -> voiceTokenService.issue("ABC234", principal(42L, 99L)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void WAITING_상태면_CONFLICT() {
        when(roomRepository.findByRoomCode("ABC234"))
                .thenReturn(Optional.of(room(31L, "WAITING")));

        assertThatThrownBy(() -> voiceTokenService.issue("ABC234", principal(42L, 31L)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    void 종료된_방이면_ROOM_CLOSED() {
        when(roomRepository.findByRoomCode("ABC234"))
                .thenReturn(Optional.of(room(31L, "FINISHED")));

        assertThatThrownBy(() -> voiceTokenService.issue("ABC234", principal(42L, 31L)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_CLOSED);
    }

    @Test
    void 만료된_방이면_ROOM_CLOSED() {
        Room expired = Room.builder()
                .id(31L)
                .roomCode("ABC234")
                .status("IN_PROGRESS")
                .expiresAt(LocalDateTime.now(AppZone.KST).minusMinutes(1))
                .build();
        when(roomRepository.findByRoomCode("ABC234")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> voiceTokenService.issue("ABC234", principal(42L, 31L)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_CLOSED);
    }

    @Test
    void 퇴장한_참가자면_FORBIDDEN() {
        when(roomRepository.findByRoomCode("ABC234"))
                .thenReturn(Optional.of(room(31L, "IN_PROGRESS")));
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(anyLong(), anyLong()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> voiceTokenService.issue("ABC234", principal(42L, 31L)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void 없는_방이면_ROOM_NOT_FOUND() {
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> voiceTokenService.issue("XXXXXX", principal(42L, 31L)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_NOT_FOUND);
    }
}
