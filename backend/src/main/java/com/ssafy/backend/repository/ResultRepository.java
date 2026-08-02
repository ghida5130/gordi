package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Result;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ResultRepository extends JpaRepository<Result, Long> {

    @Query("""
        select r from Result r
        join fetch r.room
        join fetch r.tryOnJob
        where r.ownerUser.email = :email
        order by r.createdAt desc
        """)
    List<Result> findAllByOwnerEmail(String email);

    @Query("""
        select r from Result r
        join fetch r.room
        join fetch r.tryOnJob
        where r.room.roomCode = :roomCode
        """)
    Optional<Result> findByRoomCode(@Param("roomCode") String roomCode);
}
