package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Tier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TierRepository extends JpaRepository<Tier, Long> {

    List<Tier> findAllByRoomIdOrderByPositionAsc(Long roomId);
}
