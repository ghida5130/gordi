package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {

    Optional<RoomParticipant> findByRoomIdAndUserId(Long roomId, Long userId);

    long countByRoomIdAndLeftAtIsNull(Long roomId);

    List<RoomParticipant> findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(Long roomId);

    @Query("""
        select rp from RoomParticipant rp
        join fetch rp.room
        where rp.user.email = :email
          and rp.leftAt is null
          and rp.room.status = 'IN_PROGRESS'
        order by rp.joinedAt desc
        """)
    List<RoomParticipant> findActiveByUserEmail(String email);

}
