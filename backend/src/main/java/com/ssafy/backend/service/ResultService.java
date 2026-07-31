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
                .findByResultIdInOrderByResultTierIdAscPositionAsc(ids).stream()
                .collect(Collectors.groupingBy(bi -> bi.getResult().getId()));

        List<MyResultListResponseDTO.Item> items = results.stream()
                .map(r -> new MyResultListResponseDTO.Item(
                        r.getId(),
                        r.getRoom().getRoomCode(),
                        boardItemsByResultId.getOrDefault(r.getId(), List.of()).stream()
                                .limit(3)
                                .map(bi -> new MyResultListResponseDTO.TopItem(
                                        bi.getProduct().getId(),
                                        bi.getProduct().getName(),
                                        bi.getProduct().getBrand(),
                                        bi.getProduct().getPrice(),
                                        bi.getProduct().getImageUrl()))
                                .toList(),
                        r.getTryOnJob().getResultImageUrl(),
                        r.getCreatedAt().atZone(AppZone.KST).toInstant()))
                .toList();

        return new MyResultListResponseDTO(items);
    }
}