package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.util.ImageUrlResolver;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Result;
import com.ssafy.backend.domain.ResultBoardItem;
import com.ssafy.backend.domain.ResultTier;
import com.ssafy.backend.dto.results.MyResultListResponseDTO;
import com.ssafy.backend.dto.results.RoomResultResponseDTO;
import com.ssafy.backend.repository.ResultBoardItemRepository;
import com.ssafy.backend.repository.ResultRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResultService {

    private static final String DEFAULT_DISCLAIMER =
            "생성 이미지는 실제 핏과 다를 수 있습니다.";

    private final ResultRepository resultRepository;
    private final ResultBoardItemRepository resultBoardItemRepository;
    private final RoomAccessValidator roomAccessValidator;
    private final ImageUrlResolver imageUrlResolver;

    public MyResultListResponseDTO readMyResults(String email) {
        List<Result> results = resultRepository.findAllByOwnerEmail(email);
        if (results.isEmpty()) {
            return new MyResultListResponseDTO(List.of());
        }

        List<Long> ids = results.stream().map(Result::getId).toList();

        Map<Long, List<ResultBoardItem>> boardItemsByResultId = resultBoardItemRepository
                .findAllByResultIdInSnapshotOrder(ids).stream()
                .collect(Collectors.groupingBy(bi -> bi.getResult().getId()));

        List<MyResultListResponseDTO.Item> items = results.stream()
                .map(r -> new MyResultListResponseDTO.Item(
                        r.getId(),
                        r.getRoom().getRoomCode(),
                        toMyResultTopItems(boardItemsByResultId.getOrDefault(r.getId(), List.of())),
                        getSnapshotImageUrl(r),
                        r.getCreatedAt().atZone(AppZone.KST).toInstant()))
                .toList();

        return new MyResultListResponseDTO(items);
    }

    public RoomResultResponseDTO readRoomResult(
            String rawRoomCode,
            RoomPrincipal principal
    ) {
        Result result = findByRoomCode(rawRoomCode);
        roomAccessValidator.requireParticipantHistory(result.getRoom().getId(), principal);
        return toRoomResultResponse(result);
    }

    public RoomResultResponseDTO readRoomResultByAccessToken(
            String rawRoomCode,
            String email
    ) {
        Result result = findByRoomCode(rawRoomCode);
        roomAccessValidator.requireParticipantHistory(result.getRoom().getId(), email);
        return toRoomResultResponse(result);
    }

    private Result findByRoomCode(String rawRoomCode) {
        String roomCode = normalizeRoomCode(rawRoomCode);
        return resultRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ApiException(ErrorCode.RESULT_NOT_FOUND));
    }

    private RoomResultResponseDTO toRoomResultResponse(Result result) {
        List<ResultBoardItem> orderedBoardItems = resultBoardItemRepository
                .findAllByResultIdInSnapshotOrder(List.of(result.getId())).stream()
                .sorted(Comparator
                        .comparing((ResultBoardItem item) ->
                                item.getResultTier().getPosition())
                        .thenComparing(ResultBoardItem::getPosition))
                .toList();

        List<RoomResultResponseDTO.TopItem> topItems = IntStream
                .range(0, orderedBoardItems.size())
                .mapToObj(index ->
                        toRoomResultTopItem(index, orderedBoardItems.get(index)))
                .toList();

        String snapshotImageUrl = getSnapshotImageUrl(result);

        return new RoomResultResponseDTO(
                result.getId(),
                result.getRoom().getRoomCode(),
                result.getBoardVersion(),
                topItems,
                snapshotImageUrl,
                List.of(),
                snapshotImageUrl == null ? null : DEFAULT_DISCLAIMER,
                result.getCreatedAt().atZone(AppZone.KST).toInstant()
        );
    }

    private RoomResultResponseDTO.TopItem toRoomResultTopItem(
            int index,
            ResultBoardItem item
    ) {
        Long roomItemId = item.getSourceRoomItem() == null
                ? null
                : item.getSourceRoomItem().getId();
        ResultTier resultTier = item.getResultTier();
        Long tierId = resultTier.getSourceTier() == null
                ? null
                : resultTier.getSourceTier().getId();
        RoomResultResponseDTO.TierInfo tier = new RoomResultResponseDTO.TierInfo(
                tierId,
                resultTier.getName()
        );

        return new RoomResultResponseDTO.TopItem(
                index + 1,
                roomItemId,
                item.getProduct().getId(),
                item.getProduct().getName(),
                item.getProduct().getBrand(),
                item.getProduct().getPrice(),
                imageUrlResolver.resolve(item.getProduct().getImageUrl()),
                item.getPosition(),
                tier
        );
    }

    private String getSnapshotImageUrl(Result result) {
        if (result.getTryOnJob() == null) {
            return null;
        }
        return imageUrlResolver.resolve(result.getTryOnJob().getResultImageUrl());
    }

    private List<MyResultListResponseDTO.TopItem> toMyResultTopItems(
            List<ResultBoardItem> boardItems
    ) {
        return selectTopBoardItems(boardItems).stream()
                .map(item -> new MyResultListResponseDTO.TopItem(
                        item.getProduct().getId(),
                        item.getProduct().getName(),
                        item.getProduct().getBrand(),
                        item.getProduct().getPrice(),
                        imageUrlResolver.resolve(item.getProduct().getImageUrl())
                ))
                .toList();
    }

    private List<ResultBoardItem> selectTopBoardItems(
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
                .toList();
    }

    private String normalizeRoomCode(String rawRoomCode) {
        if (rawRoomCode == null) {
            throw new ApiException(ErrorCode.RESULT_NOT_FOUND);
        }
        return rawRoomCode.strip().toUpperCase(Locale.ROOT);
    }
}
