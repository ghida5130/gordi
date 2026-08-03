package com.ssafy.backend.service;

import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Recommendation;
import com.ssafy.backend.domain.Result;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.room.RoomFinishRequestDTO;
import com.ssafy.backend.dto.room.RoomFinishResponseDTO;
import com.ssafy.backend.repository.RecommendationRepository;
import com.ssafy.backend.repository.ResultBoardItemRepository;
import com.ssafy.backend.repository.ResultRepository;
import com.ssafy.backend.repository.ResultTierRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.repository.UserRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:room_finish_integration;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "jwt.secret=room-finish-integration-test-secret-key",
        "jwt.access-token-expiration=3600000",
        "jwt.refresh-token-expiration=604800000",
        "spring.security.oauth2.client.registration.kakao.client-id=test-client",
        "spring.security.oauth2.client.registration.kakao.client-secret=test-secret"
})
@Transactional
class RoomFinishServiceIntegrationTest {

    @Autowired
    private RoomFinishService roomFinishService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RecommendationRepository recommendationRepository;
    @Autowired
    private RoomRepository roomRepository;
    @Autowired
    private RoomParticipantRepository roomParticipantRepository;
    @Autowired
    private TierRepository tierRepository;
    @Autowired
    private ResultRepository resultRepository;
    @Autowired
    private ResultTierRepository resultTierRepository;
    @Autowired
    private ResultBoardItemRepository resultBoardItemRepository;
    @Autowired
    private EntityManager entityManager;

    @Test
    void 빈_보드와_TryOnJob_없이_종료해도_Result가_DB에_저장된다() {
        User host = userRepository.saveAndFlush(User.builder()
                .email("room-finish-integration@example.com")
                .password("encoded-password")
                .nickname("host")
                .provider("LOCAL")
                .build());
        Recommendation recommendation = recommendationRepository.saveAndFlush(
                Recommendation.builder()
                        .user(host)
                        .gender("MALE")
                        .category("TOP")
                        .status("READY")
                        .version(1L)
                        .build()
        );
        Room room = roomRepository.saveAndFlush(Room.builder()
                .roomCode("A7K9Q2")
                .hostUser(host)
                .recommendation(recommendation)
                .recommendationVersion(1L)
                .maxParticipants(4)
                .idempotencyKey(UUID.randomUUID().toString())
                .status("IN_PROGRESS")
                .version(0L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(1))
                .build());
        RoomParticipant participant = roomParticipantRepository.saveAndFlush(
                RoomParticipant.builder()
                        .room(room)
                        .user(host)
                        .nickname("host")
                        .role("HOST")
                        .build()
        );
        tierRepository.saveAllAndFlush(List.of(
                Tier.builder().room(room).name("S").position(0).build(),
                Tier.builder().room(room).name("A").position(1).build(),
                Tier.builder().room(room).name("B").position(2).build()
        ));

        RoomFinishResponseDTO response = roomFinishService.finish(
                room.getRoomCode(),
                new RoomFinishRequestDTO(room.getVersion()),
                new RoomPrincipal(
                        participant.getId(),
                        room.getId(),
                        participant.getNickname(),
                        participant.getRole()
                )
        );

        entityManager.flush();
        entityManager.clear();

        Result savedResult = resultRepository.findByRoomCode(room.getRoomCode())
                .orElseThrow();
        Room finishedRoom = roomRepository.findByRoomCode(room.getRoomCode())
                .orElseThrow();

        assertThat(response.resultId()).isEqualTo(savedResult.getId());
        assertThat(response.topItems()).isEmpty();
        assertThat(response.snapshotImageUrl()).isNull();
        assertThat(savedResult.getOwnerUser().getId()).isEqualTo(host.getId());
        assertThat(savedResult.getTryOnJob()).isNull();
        assertThat(savedResult.getBoardVersion()).isZero();
        assertThat(resultTierRepository.findAll())
                .extracting(resultTier -> resultTier.getName())
                .containsExactly("S", "A", "B");
        assertThat(resultBoardItemRepository.count()).isZero();
        assertThat(finishedRoom.getStatus()).isEqualTo("FINISHED");
        assertThat(finishedRoom.getVersion()).isEqualTo(1L);
        assertThat(finishedRoom.getFinishedAt()).isNotNull();
    }
}
