package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RecommendationItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, Long> {

    List<RecommendationItem> findAllByRecommendationIdAndRecommendationVersionOrderByRankAsc(
            Long recommendationId,
            Long recommendationVersion
    );
}
