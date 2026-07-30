package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    // 추천 접근 권한 확인: 해당 추천을 참조하는 방의 호스트인지
    boolean existsByRecommendationIdAndHostUserId(Long recommendationId, Long hostUserId);


    boolean existsByRoomCode(String roomCode);

    Optional<Room> findByHostUserIdAndIdempotencyKey(Long hostUserId, String idempotencyKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select room from Room room where room.roomCode = :roomCode")
    Optional<Room> findByRoomCodeForUpdate(@Param("roomCode") String roomCode);

    // - 인자: 방 ID, 클라이언트가 알고 있는 baseVersion
    // - 동작: 버전이 일치할 때만 +1 (조건부 UPDATE로 검증과 증가를 원자적으로 수행).
    //         반환값 0이면 버전 불일치(VERSION_CONFLICT). 행 잠금으로 동시 요청도 직렬화된다.
    @Modifying
    @Query("update Room room set room.version = room.version + 1 "
            + "where room.id = :roomId and room.version = :baseVersion")
    int bumpVersionIfMatches(@Param("roomId") Long roomId, @Param("baseVersion") Long baseVersion);

}
