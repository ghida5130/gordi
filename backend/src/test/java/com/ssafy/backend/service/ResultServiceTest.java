package com.ssafy.backend.service;

import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Result;
import com.ssafy.backend.domain.ResultBoardItem;
import com.ssafy.backend.domain.ResultTier;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.dto.results.MyResultListResponseDTO;
import com.ssafy.backend.repository.ResultBoardItemRepository;
import com.ssafy.backend.repository.ResultRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ResultServiceTest {

    private final ResultRepository resultRepository = mock(ResultRepository.class);
    private final ResultBoardItemRepository resultBoardItemRepository =
            mock(ResultBoardItemRepository.class);
    private final ResultService resultService = new ResultService(
            resultRepository,
            resultBoardItemRepository
    );

    @Test
    void readMyResultsReturnsOnlyHighestNonEmptyTierAsTopItems() {
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
                .name("S")
                .position(0)
                .build();
        ResultTier tierA = ResultTier.builder()
                .id(82L)
                .result(result)
                .name("A")
                .position(1)
                .build();
        ResultBoardItem first = boardItem(result, tierS, product(101L), 10_000);
        ResultBoardItem second = boardItem(result, tierS, product(102L), 20_000);
        ResultBoardItem lowerTier = boardItem(result, tierA, product(105L), 10_000);

        when(resultRepository.findAllByOwnerEmail("host@example.com"))
                .thenReturn(List.of(result));
        when(resultBoardItemRepository.findAllByResultIdInSnapshotOrder(List.of(51L)))
                .thenReturn(List.of(lowerTier, second, first));

        MyResultListResponseDTO response = resultService.readMyResults("host@example.com");

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).topItems())
                .extracting(MyResultListResponseDTO.TopItem::productId)
                .containsExactly(101L, 102L);
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
