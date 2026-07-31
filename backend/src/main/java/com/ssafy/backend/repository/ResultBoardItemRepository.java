package com.ssafy.backend.repository;

import com.ssafy.backend.domain.ResultBoardItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResultBoardItemRepository extends JpaRepository<ResultBoardItem, Long> {
    List<ResultBoardItem> findByResultIdInOrderByResultTierIdAscPositionAsc(List<Long> resultIds);
}