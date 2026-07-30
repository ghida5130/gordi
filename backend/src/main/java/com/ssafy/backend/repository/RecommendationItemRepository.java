package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RecommendationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, Long> {

    List<RecommendationItem> findAllByRecommendationIdAndRecommendationVersionOrderByRankAsc(
            Long recommendationId,
            Long recommendationVersion
    );

    @Query("""
            SELECT i FROM RecommendationItem i
            JOIN FETCH i.product
            WHERE i.recommendation.id = :recommendationId
              AND i.recommendationVersion = :version
            ORDER BY i.rank ASC
            """)
    List<RecommendationItem> findVersionItems(
            @Param("recommendationId") Long recommendationId,
            @Param("version") Long version
    );

    @Query("""
            SELECT DISTINCT i.product.id FROM RecommendationItem i
            WHERE i.recommendation.id = :recommendationId
            """)
    List<Long> findAllExposedProductIds(@Param("recommendationId") Long recommendationId);
}
