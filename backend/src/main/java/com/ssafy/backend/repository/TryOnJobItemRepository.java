package com.ssafy.backend.repository;

import com.ssafy.backend.domain.TryOnJobItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TryOnJobItemRepository extends JpaRepository<TryOnJobItem, Long> {

    /**
     * Job 의 착장 구성 조회.
     * 재시도 시 원본 구성을 그대로 복제하므로 product 를 함께 fetch 한다.
     */
    @Query("""
            select item from TryOnJobItem item
            join fetch item.product
            left join fetch item.roomItem
            where item.tryOnJob.id = :tryOnJobId
            order by item.position asc
            """)
    List<TryOnJobItem> findAllByTryOnJobIdWithProduct(@Param("tryOnJobId") Long tryOnJobId);
}
