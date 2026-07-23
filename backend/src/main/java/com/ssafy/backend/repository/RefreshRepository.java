package com.ssafy.backend.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.util.RefreshEntity;

public interface RefreshRepository extends JpaRepository<RefreshEntity, Long> {
    Boolean existsByRefresh(String refreshToken);
    void deleteByRefresh(String refresh);
    void deleteByLoginId(String loginId);
    void deleteByCreatedDateBefore(LocalDateTime createdDate);
}