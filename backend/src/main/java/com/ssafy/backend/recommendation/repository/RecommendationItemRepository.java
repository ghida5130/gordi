package com.ssafy.backend.recommendation.repository;

import com.ssafy.backend.recommendation.domain.RecommendationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, Long> {

    // 특정 버전의 추천 결과 (상품까지 함께 로딩)
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

    // 과거에 노출된 모든 상품 (버전 무관) - 재추천 제외 대상
    @Query("""
            SELECT DISTINCT i.product.id FROM RecommendationItem i
            WHERE i.recommendation.id = :recommendationId
            """)
    List<Long> findAllExposedProductIds(@Param("recommendationId") Long recommendationId);
}
