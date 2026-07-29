package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

}
