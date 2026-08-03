package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.enums.RoomRole;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomAuthResolverTest {

    private static final String EMAIL = "member@example.com";
    private static final Long USER_ID = 1L;
    private static final Long ROOM_ID = 10L;

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoomParticipantRepository roomParticipantRepository;

    private RoomAuthResolver roomAuthResolver;

    @BeforeEach
    void setUp() {
        roomAuthResolver = new RoomAuthResolver(userRepository, roomParticipantRepository);
    }

    @Test
    void 인증된_회원은_해석된다() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(member()));

        User resolved = roomAuthResolver.requireMember(memberAuthentication());

        assertThat(resolved.getId()).isEqualTo(USER_ID);
    }

    @Test
    void 인증이_없으면_UNAUTHORIZED() {
        assertThatThrownBy(() -> roomAuthResolver.requireMember(null))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void 익명_인증은_UNAUTHORIZED() {
        Authentication anonymous = new AnonymousAuthenticationToken(
                "key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));

        assertThatThrownBy(() -> roomAuthResolver.requireMember(anonymous))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void 참가한_방의_참가정보를_반환한다() {
        Room room = room();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(roomParticipantRepository.findByRoomIdAndUserId(ROOM_ID, USER_ID))
                .thenReturn(Optional.of(participant(RoomRole.HOST, null)));

        RoomParticipant resolved = roomAuthResolver.requireParticipant(memberAuthentication(), room);

        assertThat(resolved.getRole()).isEqualTo(RoomRole.HOST.name());
    }

    @Test
    void 참가한_적_없으면_FORBIDDEN() {
        Room room = room();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(roomParticipantRepository.findByRoomIdAndUserId(ROOM_ID, USER_ID))
                .thenReturn(Optional.empty());

        Authentication authentication = memberAuthentication();

        assertThatThrownBy(() -> roomAuthResolver.requireParticipant(authentication, room))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void 이미_퇴장한_참가자는_FORBIDDEN() {
        Room room = room();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(roomParticipantRepository.findByRoomIdAndUserId(ROOM_ID, USER_ID))
                .thenReturn(Optional.of(participant(RoomRole.PARTICIPANTS, LocalDateTime.now())));

        Authentication authentication = memberAuthentication();

        assertThatThrownBy(() -> roomAuthResolver.requireParticipant(authentication, room))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void HOST가_아니면_FORBIDDEN() {
        RoomParticipant participant = participant(RoomRole.PARTICIPANTS, null);

        assertThatThrownBy(() -> roomAuthResolver.requireHost(participant))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void HOST는_통과한다() {
        roomAuthResolver.requireHost(participant(RoomRole.HOST, null));
    }

    private Authentication memberAuthentication() {
        return new UsernamePasswordAuthenticationToken(
                EMAIL, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private User member() {
        return User.builder()
                .id(USER_ID)
                .email(EMAIL)
                .password("encoded")
                .nickname("회원")
                .build();
    }

    private Room room() {
        return Room.builder()
                .id(ROOM_ID)
                .roomCode("A7K9Q2")
                .maxParticipants(6)
                .idempotencyKey("room-key")
                .recommendationVersion(1L)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build();
    }

    private RoomParticipant participant(RoomRole role, LocalDateTime leftAt) {
        RoomParticipant participant = RoomParticipant.builder()
                .id(77L)
                .nickname("참가자")
                .role(role.name())
                .build();
        participant.setLeftAt(leftAt);
        return participant;
    }
}
