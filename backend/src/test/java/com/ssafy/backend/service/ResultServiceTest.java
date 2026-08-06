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
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.dto.results.MyResultListResponseDTO;
import com.ssafy.backend.dto.results.RoomResultResponseDTO;
import com.ssafy.backend.repository.ResultBoardItemRepository;
import com.ssafy.backend.repository.ResultRepository;
import com.ssafy.backend.util.ImageUrlResolver;
import com.ssafy.backend.websocket.RoomPrincipal;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ResultServiceTest {

    private final ResultRepository resultRepository = mock(ResultRepository.class);
    private final ResultBoardItemRepository resultBoardItemRepository =
            mock(ResultBoardItemRepository.class);
    private final RoomAccessValidator roomAccessValidator = mock(RoomAccessValidator.class);
    private final ResultService resultService = new ResultService(
            resultRepository,
            resultBoardItemRepository,
            roomAccessValidator,
            new ImageUrlResolver("")
    );

    @Test
    void readMyResultsReturnsOnlyTopThreeItemsFromHighestNonEmptyTier() {
        Room room = Room.builder().id(31L).roomCode("A7K9Q2").build();
        TryOnJob tryOnJob = TryOnJob.builder()
                .id(71L)
                .resultImageUrl("https://cdn.example.com/fitting.webp")
                .build();
        Result result = Result.builder()
                .id(51L)
                .room(room)
                .tryOnJob(tryOnJob)
                .createdAt(LocalDateTime.now(AppZone.KST))
                .build();
        ResultTier tierS = ResultTier.builder()
                .id(81L)
                .result(result)
                .sourceTier(Tier.builder().id(1L).build())
                .name("S")
                .position(0)
                .build();
        ResultTier tierA = ResultTier.builder()
                .id(82L)
                .result(result)
                .sourceTier(Tier.builder().id(2L).build())
                .name("A")
                .position(1)
                .build();
        ResultBoardItem first = boardItem(result, tierS, product(101L), 1);
        ResultBoardItem second = boardItem(result, tierS, product(102L), 2);
        ResultBoardItem third = boardItem(result, tierS, product(103L), 3);
        ResultBoardItem fourth = boardItem(result, tierS, product(104L), 4);
        ResultBoardItem lowerTier = boardItem(result, tierA, product(105L), 1);

        when(resultRepository.findAllByOwnerEmail("host@example.com"))
                .thenReturn(List.of(result));
        when(resultBoardItemRepository.findAllByResultIdInSnapshotOrder(List.of(51L)))
                .thenReturn(List.of(lowerTier, fourth, second, third, first));

        MyResultListResponseDTO response = resultService.readMyResults("host@example.com");

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).topItems())
                .extracting(MyResultListResponseDTO.TopItem::productId)
                .containsExactly(101L, 102L, 103L);
    }

    @Test
    void readRoomResultReturnsAllTieredItemsInTierAndItemPositionOrder() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 7, 23, 11, 0);
        Room room = Room.builder().id(31L).roomCode("A7K9Q2").build();
        TryOnJob tryOnJob = TryOnJob.builder()
                .id(71L)
                .resultImageUrl("https://cdn.example.com/fittings/71.webp")
                .build();
        Result result = Result.builder()
                .id(51L)
                .room(room)
                .tryOnJob(tryOnJob)
                .boardVersion(17L)
                .createdAt(createdAt)
                .build();
        ResultTier tierS = ResultTier.builder()
                .id(81L)
                .result(result)
                .sourceTier(Tier.builder().id(1L).build())
                .name("S")
                .position(0)
                .build();
        ResultTier tierA = ResultTier.builder()
                .id(82L)
                .result(result)
                .sourceTier(Tier.builder().id(2L).build())
                .name("A")
                .position(1)
                .build();
        ResultBoardItem first = boardItem(result, tierS, product(101L), 1);
        ResultBoardItem second = boardItem(result, tierS, product(102L), 2);
        ResultBoardItem third = boardItem(result, tierS, product(103L), 3);
        ResultBoardItem fourth = boardItem(result, tierS, product(104L), 4);
        ResultBoardItem lowerTier = boardItem(result, tierA, product(105L), 1);
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "guest", "PARTICIPANTS");

        when(resultRepository.findByRoomCode("A7K9Q2")).thenReturn(Optional.of(result));
        when(resultBoardItemRepository.findAllByResultIdInSnapshotOrder(List.of(51L)))
                .thenReturn(List.of(lowerTier, fourth, second, third, first));

        RoomResultResponseDTO response = resultService.readRoomResult(
                " a7k9q2 ",
                principal
        );

        assertThat(response.resultId()).isEqualTo(51L);
        assertThat(response.roomCode()).isEqualTo("A7K9Q2");
        assertThat(response.boardVersion()).isEqualTo(17L);
        assertThat(response.topItems())
                .extracting(
                        RoomResultResponseDTO.TopItem::rank,
                        RoomResultResponseDTO.TopItem::roomItemId,
                        RoomResultResponseDTO.TopItem::productId,
                        RoomResultResponseDTO.TopItem::name,
                        RoomResultResponseDTO.TopItem::brand,
                        RoomResultResponseDTO.TopItem::price,
                        RoomResultResponseDTO.TopItem::imageUrl,
                        RoomResultResponseDTO.TopItem::position,
                        RoomResultResponseDTO.TopItem::tierId
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                1, 301L, 101L, "product-101", "brand", 10_000,
                                "https://example.com/101.png", 1, 1L
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                2, 302L, 102L, "product-102", "brand", 10_000,
                                "https://example.com/102.png", 2, 1L
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                3, 303L, 103L, "product-103", "brand", 10_000,
                                "https://example.com/103.png", 3, 1L
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                4, 304L, 104L, "product-104", "brand", 10_000,
                                "https://example.com/104.png", 4, 1L
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                5, 305L, 105L, "product-105", "brand", 10_000,
                                "https://example.com/105.png", 1, 2L
                        )
                );
        assertThat(response.snapshotImageUrl())
                .isEqualTo("https://cdn.example.com/fittings/71.webp");
        assertThat(response.fitSummary()).isEmpty();
        assertThat(response.disclaimer())
                .isEqualTo("생성 이미지는 실제 핏과 다를 수 있습니다.");
        assertThat(response.createdAt())
                .isEqualTo(createdAt.atZone(AppZone.KST).toInstant());
        verify(roomAccessValidator).requireParticipantHistory(31L, principal);
    }

    @Test
    void readRoomResultByAccessTokenValidatesHistoricalMemberParticipation() {
        Room room = Room.builder().id(31L).roomCode("A7K9Q2").build();
        Result result = Result.builder()
                .id(51L)
                .room(room)
                .tryOnJob(TryOnJob.builder().resultImageUrl("https://cdn/result.webp").build())
                .boardVersion(17L)
                .createdAt(LocalDateTime.now(AppZone.KST))
                .build();
        when(resultRepository.findByRoomCode("A7K9Q2")).thenReturn(Optional.of(result));
        when(resultBoardItemRepository.findAllByResultIdInSnapshotOrder(List.of(51L)))
                .thenReturn(List.of());

        resultService.readRoomResultByAccessToken("A7K9Q2", "member@example.com");

        verify(roomAccessValidator).requireParticipantHistory(31L, "member@example.com");
    }

    @Test
    void readRoomResultWithoutTryOnReturnsEmptySnapshotFields() {
        Room room = Room.builder().id(31L).roomCode("A7K9Q2").build();
        Result result = Result.builder()
                .id(51L)
                .room(room)
                .boardVersion(17L)
                .createdAt(LocalDateTime.now(AppZone.KST))
                .build();
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "guest", "PARTICIPANTS");
        when(resultRepository.findByRoomCode("A7K9Q2")).thenReturn(Optional.of(result));
        when(resultBoardItemRepository.findAllByResultIdInSnapshotOrder(List.of(51L)))
                .thenReturn(List.of());

        RoomResultResponseDTO response = resultService.readRoomResult("A7K9Q2", principal);

        assertThat(response.resultId()).isEqualTo(51L);
        assertThat(response.topItems()).isEmpty();
        assertThat(response.snapshotImageUrl()).isNull();
        assertThat(response.fitSummary()).isEmpty();
        assertThat(response.disclaimer()).isNull();
    }

    @Test
    void readMyResultsIncludesResultWithoutTryOn() {
        Room room = Room.builder().id(31L).roomCode("A7K9Q2").build();
        Result result = Result.builder()
                .id(51L)
                .room(room)
                .createdAt(LocalDateTime.now(AppZone.KST))
                .build();
        when(resultRepository.findAllByOwnerEmail("host@example.com"))
                .thenReturn(List.of(result));
        when(resultBoardItemRepository.findAllByResultIdInSnapshotOrder(List.of(51L)))
                .thenReturn(List.of());

        MyResultListResponseDTO response = resultService.readMyResults("host@example.com");

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).snapshotImageUrl()).isNull();
    }

    @Test
    void readRoomResultThrowsResultNotFoundWhenSnapshotDoesNotExist() {
        when(resultRepository.findByRoomCode("A7K9Q2")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resultService.readRoomResult(
                "A7K9Q2",
                new RoomPrincipal(42L, 31L, "guest", "PARTICIPANTS")
        )).isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESULT_NOT_FOUND));
    }

    private ResultBoardItem boardItem(
            Result result,
            ResultTier tier,
            Product product,
            int position
    ) {
        return ResultBoardItem.builder()
                .result(result)
                .resultTier(tier)
                .sourceRoomItem(RoomItem.builder().id(product.getId() + 200L).build())
                .product(product)
                .position(position)
                .build();
    }

    private Product product(Long id) {
        return Product.builder()
                .id(id)
                .name("product-" + id)
                .brand("brand")
                .price(10_000)
                .imageUrl("https://example.com/" + id + ".png")
                .build();
    }
}
