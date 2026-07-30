package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {

    Optional<RoomParticipant> findByRoomIdAndUserId(Long roomId, Long userId);

    long countByRoomIdAndLeftAtIsNull(Long roomId);

    List<RoomParticipant> findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(Long roomId);
}
