package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Result;
import com.ssafy.backend.domain.ResultBoardItem;
import com.ssafy.backend.domain.ResultTier;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.dto.room.RoomFinishRequestDTO;
import com.ssafy.backend.dto.room.RoomFinishResponseDTO;
import com.ssafy.backend.repository.ResultBoardItemRepository;
import com.ssafy.backend.repository.ResultRepository;
import com.ssafy.backend.repository.ResultTierRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.repository.TryOnJobRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.event.RoomFinishedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class RoomFinishService {

    private static final String HOST = "HOST";
    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String FINISHED = "FINISHED";

    private final RoomRepository roomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final RoomItemRepository roomItemRepository;
    private final TierRepository tierRepository;
    private final TryOnJobRepository tryOnJobRepository;
    private final ResultRepository resultRepository;
    private final ResultTierRepository resultTierRepository;
    private final ResultBoardItemRepository resultBoardItemRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public RoomFinishResponseDTO finish(
            String rawRoomCode,
            RoomFinishRequestDTO request,
            RoomPrincipal principal
    ) {
        validateRequest(request);

        String roomCode = normalizeRoomCode(rawRoomCode);
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));

        requireHost(room, principal);
        validateFinishable(room);

        List<Tier> tiers = tierRepository.findAllByRoomIdOrderByPositionAsc(room.getId());
        List<RoomItem> roomItems = roomItemRepository.findAllByRoomIdWithProduct(room.getId());
        List<Product> topProducts = resolveTopProducts(
                tiers,
                roomItems,
                request.topProductIds()
        );
        TryOnJob tryOnJob = findLatestCompletedTryOnJob(room.getId());

        LocalDateTime finishedAt = LocalDateTime.now(AppZone.KST);
        if (roomRepository.finishIfVersionMatches(
                room.getId(),
                request.expectedVersion(),
                finishedAt
        ) == 0) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT);
        }

        Result result = resultRepository.save(Result.builder()
                .room(room)
                .ownerUser(room.getHostUser())
                .tryOnJob(tryOnJob)
                .boardVersion(request.expectedVersion())
                .build());

        Map<Long, ResultTier> resultTierBySourceId = snapshotTiers(result, tiers);
        snapshotBoardItems(result, roomItems, resultTierBySourceId);

        eventPublisher.publishEvent(new RoomFinishedEvent(
                room.getId(),
                request.expectedVersion() + 1,
                principal.participantId()
        ));

        return new RoomFinishResponseDTO(
                result.getId(),
                room.getId(),
                FINISHED,
                topProducts.stream().map(this::toTopItem).toList(),
                tryOnJob.getResultImageUrl(),
                finishedAt.atZone(AppZone.KST).toInstant()
        );
    }

    private Map<Long, ResultTier> snapshotTiers(Result result, List<Tier> tiers) {
        List<ResultTier> resultTiers = tiers.stream()
                .map(tier -> ResultTier.builder()
                        .result(result)
                        .sourceTier(tier)
                        .name(tier.getName())
                        .position(tier.getPosition())
                        .build())
                .toList();
        resultTierRepository.saveAll(resultTiers);

        Map<Long, ResultTier> resultTierBySourceId = new HashMap<>();
        for (int index = 0; index < tiers.size(); index++) {
            resultTierBySourceId.put(tiers.get(index).getId(), resultTiers.get(index));
        }
        return resultTierBySourceId;
    }

    private void snapshotBoardItems(
            Result result,
            List<RoomItem> roomItems,
            Map<Long, ResultTier> resultTierBySourceId
    ) {
        List<ResultBoardItem> boardItems = roomItems.stream()
                .filter(roomItem -> roomItem.getTier() != null)
                .map(roomItem -> ResultBoardItem.builder()
                        .result(result)
                        .resultTier(resultTierBySourceId.get(roomItem.getTier().getId()))
                        .sourceRoomItem(roomItem)
                        .product(roomItem.getProduct())
                        .position(roomItem.getPosition())
                        .build())
                .toList();
        resultBoardItemRepository.saveAll(boardItems);
    }

    private List<Product> resolveTopProducts(
            List<Tier> tiers,
            List<RoomItem> roomItems,
            List<Long> requestedProductIds
    ) {
        List<RoomItem> highestTierItems = tiers.stream()
                .map(tier -> roomItems.stream()
                        .filter(item -> item.getTier() != null)
                        .filter(item -> Objects.equals(item.getTier().getId(), tier.getId()))
                        .sorted((left, right) -> Integer.compare(
                                left.getPosition(),
                                right.getPosition()
                        ))
                        .toList())
                .filter(items -> !items.isEmpty())
                .findFirst()
                .orElseThrow(() -> new ApiException(
                        ErrorCode.CONFLICT,
                        "분류된 상품이 없어 방을 종료할 수 없습니다."
                ));

        int topItemCount = Math.min(3, highestTierItems.size());
        List<Long> expectedProductIds = highestTierItems.stream()
                .limit(topItemCount)
                .map(item -> item.getProduct().getId())
                .toList();
        if (!expectedProductIds.equals(requestedProductIds)) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "topProductIds는 가장 높은 티어의 position 순서와 일치해야 합니다.",
                    Map.of(
                            "field", "topProductIds",
                            "expectedTopProductIds", expectedProductIds
                    )
            );
        }

        return highestTierItems.stream()
                .limit(topItemCount)
                .map(RoomItem::getProduct)
                .toList();
    }

    private TryOnJob findLatestCompletedTryOnJob(Long roomId) {
        TryOnJob tryOnJob = tryOnJobRepository
                .findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(roomId)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("resource", "tryOnJob")
                ));
        if (tryOnJob.getResultImageUrl().isBlank()) {
            throw new ApiException(
                    ErrorCode.RESOURCE_NOT_FOUND,
                    Map.of("resource", "tryOnJob")
            );
        }
        return tryOnJob;
    }

    private void requireHost(Room room, RoomPrincipal principal) {
        if (principal == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
        if (!Objects.equals(room.getId(), principal.roomId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        RoomParticipant participant = roomParticipantRepository
                .findByIdAndRoomIdAndLeftAtIsNull(principal.participantId(), room.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));
        if (!HOST.equals(participant.getRole())) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    Map.of("requiredRole", HOST)
            );
        }
    }

    private void validateFinishable(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        if (expired || FINISHED.equals(room.getStatus()) || "CLOSED".equals(room.getStatus())) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
        if (!IN_PROGRESS.equals(room.getStatus())) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "IN_PROGRESS 상태의 방만 종료할 수 있습니다.",
                    Map.of("status", room.getStatus())
            );
        }
    }

    private void validateRequest(RoomFinishRequestDTO request) {
        if (request == null
                || request.expectedVersion() == null
                || request.expectedVersion() < 0
                || request.topProductIds() == null
                || request.topProductIds().isEmpty()
                || request.topProductIds().size() > 3
                || request.topProductIds().stream().anyMatch(id -> id == null || id <= 0)
                || new HashSet<>(request.topProductIds()).size() != request.topProductIds().size()) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }

    private RoomFinishResponseDTO.TopItem toTopItem(Product product) {
        return new RoomFinishResponseDTO.TopItem(
                product.getId(),
                product.getName(),
                product.getBrand(),
                product.getPrice(),
                product.getImageUrl()
        );
    }

    private String normalizeRoomCode(String rawRoomCode) {
        if (rawRoomCode == null) {
            throw new ApiException(ErrorCode.ROOM_NOT_FOUND);
        }
        return rawRoomCode.strip().toUpperCase(Locale.ROOT);
    }
}
