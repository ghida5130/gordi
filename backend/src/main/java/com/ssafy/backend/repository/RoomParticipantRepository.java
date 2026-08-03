package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {

    Optional<RoomParticipant> findByRoomIdAndUserId(Long roomId, Long userId);

    Optional<RoomParticipant> findByRoomIdAndUserEmailAndLeftAtIsNull(Long roomId, String email);

    Optional<RoomParticipant> findByIdAndRoomIdAndLeftAtIsNull(Long participantId, Long roomId);

    boolean existsByIdAndRoomIdAndLeftAtIsNull(Long participantId, Long roomId);

    long countByRoomIdAndLeftAtIsNull(Long roomId);

    List<RoomParticipant> findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(Long roomId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RoomParticipant rp set rp.leftAt = :leftAt "
            + "where rp.id = :participantId and rp.room.id = :roomId and rp.leftAt is null")
    int markLeftIfActive(
            @Param("participantId") Long participantId,
            @Param("roomId") Long roomId,
            @Param("leftAt") LocalDateTime leftAt
    );

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
