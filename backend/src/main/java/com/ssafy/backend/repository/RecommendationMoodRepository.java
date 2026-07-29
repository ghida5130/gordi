package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RecommendationMood;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecommendationMoodRepository extends JpaRepository<RecommendationMood, Long> {

    // 선택한 순서대로 무드 조회
    List<RecommendationMood> findByRecommendationIdOrderByPositionAsc(Long recommendationId);
}
