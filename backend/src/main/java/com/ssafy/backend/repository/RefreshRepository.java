package com.ssafy.backend.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.domain.RefreshToken;

public interface RefreshRepository extends JpaRepository<RefreshToken, Long> {
    Boolean existsByRefresh(String refreshToken);
    void deleteByRefresh(String refresh);
    void deleteByLoginId(String loginId);
    void deleteByCreatedDateBefore(LocalDateTime createdDate);

    Optional<RefreshToken> findByRefresh(String refresh);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.rotatedAt = :now WHERE r.refresh = :refresh AND r.rotatedAt IS NULL")
    int markRotated(@Param("refresh") String refresh, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.successor = :successor WHERE r.refresh = :refresh")
    int updateSuccessor(@Param("refresh") String refresh, @Param("successor") String successor);

}
