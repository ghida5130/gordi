package com.ssafy.backend.repository;

import com.ssafy.backend.domain.ResultTier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResultTierRepository extends JpaRepository<ResultTier, Long> {

    List<ResultTier> findAllByResult_IdOrderByPositionAsc(Long resultId);
}
