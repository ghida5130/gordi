package com.ssafy.backend.service;

import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.dto.candidate.CandidateAddRequestDTO;
import com.ssafy.backend.dto.candidate.CandidateResponseDTO;
import com.ssafy.backend.repository.ProductRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.util.ImageUrlResolver;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.PlacementDTO;
import com.ssafy.backend.websocket.event.ItemAddedEvent;
import com.ssafy.backend.websocket.event.ItemRemovedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateServiceTest {

    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private RoomAccessValidator roomAccessValidator;
    @Mock
    private ImageUrlResolver imageUrlResolver;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private CandidateService candidateService;

    private Room room;
    private Product product;
    private RoomPrincipal principal;

    @BeforeEach
    void setUp() {
        room = Room.builder().id(10L).version(13L).build();
        product = Product.builder()
                .id(501L)
                .name("오버핏 시어커튼 셔츠")
                .brand("MUSINSA STANDARD")
                .price(39_900)
                .imageUrl("/products/501.jpg")
                .build();
        principal = new RoomPrincipal(42L, 10L, "참여자", "PARTICIPANT");
    }

    @Test
    void addPublishesItemAddedWithDisplayItemAndFullPlacements() {
        LocalDateTime updatedAt = LocalDateTime.of(2026, 8, 4, 9, 0);
        RoomItem existing = RoomItem.builder()
                .id(201L)
                .room(room)
                .position(10_000)
                .build();

        stubAdd(List.of(existing), updatedAt);

        CandidateResponseDTO response = candidateService.add(
                new CandidateAddRequestDTO(10L, 501L),
                principal
        );

        assertThat(response.roomItemId()).isEqualTo(301L);
        assertThat(response.position()).isEqualTo(5_000);
        assertThat(response.updatedAt()).isEqualTo(updatedAt);
        verify(roomRepository).incrementVersion(10L);

        ItemAddedEvent event = capturedEvent();
        assertThat(event.roomId()).isEqualTo(10L);
        assertThat(event.roomVersion()).isEqualTo(14L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.item().roomItemId()).isEqualTo(301L);
        assertThat(event.item().productId()).isEqualTo(501L);
        assertThat(event.item().name()).isEqualTo("오버핏 시어커튼 셔츠");
        assertThat(event.item().brand()).isEqualTo("MUSINSA STANDARD");
        assertThat(event.item().price()).isEqualTo(39_900);
        assertThat(event.item().imageUrl()).isEqualTo("https://cdn.example.com/products/501.jpg");
        assertThat(event.item().position()).isEqualTo(5_000);
        assertThat(event.item().tierId()).isNull();
        assertThat(event.placements()).containsExactlyInAnyOrder(
                new PlacementDTO(201L, null, 10_000),
                new PlacementDTO(301L, null, 5_000)
        );
    }

    @Test
    void addReindexesOnlyUnclassifiedItemsWhenFrontGapIsExhausted() {
        RoomItem existingUnclassified = RoomItem.builder()
                .id(201L)
                .room(room)
                .position(0)
                .build();
        Tier tier = Tier.builder().id(3L).room(room).position(0).build();
        RoomItem tierItem = RoomItem.builder()
                .id(202L)
                .room(room)
                .tier(tier)
                .position(0)
                .build();

        stubAdd(List.of(existingUnclassified, tierItem), LocalDateTime.now());

        CandidateResponseDTO response = candidateService.add(
                new CandidateAddRequestDTO(10L, 501L),
                principal
        );

        assertThat(response.position()).isEqualTo(10_000);
        assertThat(existingUnclassified.getPosition()).isEqualTo(20_000);
        assertThat(tierItem.getPosition()).isZero();

        assertThat(capturedEvent().placements()).containsExactlyInAnyOrder(
                new PlacementDTO(201L, null, 20_000),
                new PlacementDTO(202L, 3L, 0),
                new PlacementDTO(301L, null, 10_000)
        );
    }

    @Test
    void deletePublishesItemRemovedWithIncrementedRoomVersion() {
        RoomItem roomItem = RoomItem.builder()
                .id(301L)
                .room(room)
                .product(product)
                .position(10_000)
                .build();
        when(roomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));
        when(roomItemRepository.findByRoomIdAndProductId(10L, 501L))
                .thenReturn(Optional.of(roomItem));
        when(roomRepository.incrementVersion(10L)).thenReturn(1);
        when(roomRepository.findVersionValueById(10L)).thenReturn(15L);

        candidateService.delete(10L, 501L, principal);

        verify(roomItemRepository).delete(roomItem);
        verify(roomRepository).incrementVersion(10L);

        ArgumentCaptor<ItemRemovedEvent> captor = ArgumentCaptor.forClass(ItemRemovedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        ItemRemovedEvent event = captor.getValue();
        assertThat(event.roomId()).isEqualTo(10L);
        assertThat(event.roomVersion()).isEqualTo(15L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.roomItemId()).isEqualTo(301L);
        assertThat(event.productId()).isEqualTo(501L);
    }

    private void stubAdd(List<RoomItem> existingItems, LocalDateTime updatedAt) {
        when(roomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));
        when(productRepository.findById(501L)).thenReturn(Optional.of(product));
        when(roomItemRepository.existsByRoomIdAndProductId(10L, 501L)).thenReturn(false);
        when(roomItemRepository.findAllByRoomIdOrderByPositionAsc(10L)).thenReturn(existingItems);
        when(roomItemRepository.save(any(RoomItem.class))).thenAnswer(invocation -> {
            RoomItem saved = invocation.getArgument(0);
            saved.setId(301L);
            saved.setUpdatedAt(updatedAt);
            return saved;
        });
        when(roomRepository.incrementVersion(10L)).thenReturn(1);
        when(roomRepository.findVersionValueById(10L)).thenReturn(14L);
        when(imageUrlResolver.resolve("/products/501.jpg"))
                .thenReturn("https://cdn.example.com/products/501.jpg");
    }

    private ItemAddedEvent capturedEvent() {
        ArgumentCaptor<ItemAddedEvent> captor = ArgumentCaptor.forClass(ItemAddedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        return captor.getValue();
    }
}
