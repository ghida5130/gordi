package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Room;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {

    boolean existsByRoomCode(String roomCode);

    Optional<Room> findByHostUserIdAndIdempotencyKey(Long hostUserId, String idempotencyKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select room from Room room where room.roomCode = :roomCode")
    Optional<Room> findByRoomCodeForUpdate(@Param("roomCode") String roomCode);
}
