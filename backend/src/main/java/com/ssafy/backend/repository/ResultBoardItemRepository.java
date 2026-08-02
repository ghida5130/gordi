package com.ssafy.backend.repository;

import com.ssafy.backend.domain.ResultBoardItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ResultBoardItemRepository extends JpaRepository<ResultBoardItem, Long> {

    @Query("""
        select boardItem from ResultBoardItem boardItem
        join fetch boardItem.product
        join fetch boardItem.resultTier resultTier
        where boardItem.result.id in :resultIds
        order by boardItem.result.id, resultTier.position, boardItem.position
        """)
    List<ResultBoardItem> findAllByResultIdInSnapshotOrder(@Param("resultIds") List<Long> resultIds);
}
