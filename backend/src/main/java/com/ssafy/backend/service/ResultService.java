package com.ssafy.backend.service;

import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Result;
import com.ssafy.backend.domain.ResultBoardItem;
import com.ssafy.backend.dto.results.MyResultListResponseDTO;
import com.ssafy.backend.repository.ResultBoardItemRepository;
import com.ssafy.backend.repository.ResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResultService {

    private final ResultRepository resultRepository;
    private final ResultBoardItemRepository resultBoardItemRepository;

    public MyResultListResponseDTO readMyResults(String email) {
        List<Result> results = resultRepository.findAllByOwnerEmail(email);
        List<Long> ids = results.stream().map(Result::getId).toList();

        Map<Long, List<ResultBoardItem>> boardItemsByResultId = resultBoardItemRepository
                .findAllByResultIdInSnapshotOrder(ids).stream()
                .collect(Collectors.groupingBy(bi -> bi.getResult().getId()));

        List<MyResultListResponseDTO.Item> items = results.stream()
                .map(r -> new MyResultListResponseDTO.Item(
                        r.getId(),
                        r.getRoom().getRoomCode(),
                        toTopItems(boardItemsByResultId.getOrDefault(r.getId(), List.of())),
                        r.getTryOnJob().getResultImageUrl(),
                        r.getCreatedAt().atZone(AppZone.KST).toInstant()))
                .toList();

        return new MyResultListResponseDTO(items);
    }

    private List<MyResultListResponseDTO.TopItem> toTopItems(
            List<ResultBoardItem> boardItems
    ) {
        if (boardItems.isEmpty()) {
            return List.of();
        }
        int highestTierPosition = boardItems.stream()
                .mapToInt(item -> item.getResultTier().getPosition())
                .min()
                .orElseThrow();
        return boardItems.stream()
                .filter(item -> item.getResultTier().getPosition() == highestTierPosition)
                .sorted(Comparator.comparing(ResultBoardItem::getPosition))
                .limit(3)
                .map(item -> new MyResultListResponseDTO.TopItem(
                        item.getProduct().getId(),
                        item.getProduct().getName(),
                        item.getProduct().getBrand(),
                        item.getProduct().getPrice(),
                        item.getProduct().getImageUrl()
                ))
                .toList();
    }
}
