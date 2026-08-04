package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.util.ImageUrlResolver;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.dto.candidate.CandidateAddRequestDTO;
import com.ssafy.backend.dto.candidate.CandidateItemDTO;
import com.ssafy.backend.dto.candidate.CandidateListResponseDTO;
import com.ssafy.backend.dto.candidate.CandidateResponseDTO;
import com.ssafy.backend.repository.ProductRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.PlacementDTO;
import com.ssafy.backend.websocket.event.ItemAddedEvent;
import com.ssafy.backend.websocket.event.ItemRemovedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CandidateService {

    private static final int POSITION_STEP = 10_000;

    private final RoomItemRepository roomItemRepository;
    private final RoomRepository roomRepository;
    private final ProductRepository productRepository;
    private final RoomAccessValidator roomAccessValidator;
    private final ImageUrlResolver imageUrlResolver;
    private final ApplicationEventPublisher eventPublisher;

    /** 후보 의상 추가: product를 room에 넣는다 */
    public CandidateResponseDTO add(CandidateAddRequestDTO request, RoomPrincipal principal) {
        roomAccessValidator.requireParticipant(request.roomId(), principal);

        Room room = roomRepository.findByIdForUpdate(request.roomId())
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        if (roomItemRepository.existsByRoomIdAndProductId(room.getId(), product.getId())) {
            throw new ApiException(ErrorCode.CONFLICT);
        }

        List<RoomItem> roomItems = new ArrayList<>(
                roomItemRepository.findAllByRoomIdOrderByPositionAsc(room.getId())
        );
        List<RoomItem> unclassifiedItems = roomItems.stream()
                .filter(item -> item.getTier() == null)
                .sorted(Comparator.comparing(RoomItem::getPosition))
                .toList();

        RoomItem roomItem = RoomItem.builder()
                .room(room)
                .product(product)
                .position(resolveNewPosition(unclassifiedItems))
                .build();

        if (roomItem.getPosition() == null) {
            reindexWithNewItemFirst(roomItem, unclassifiedItems);
        }

        roomItemRepository.save(roomItem);
        roomItems.add(roomItem);

        if (roomRepository.incrementVersion(room.getId()) != 1) {
            throw new ApiException(ErrorCode.ROOM_NOT_FOUND);
        }
        Long roomVersion = roomRepository.findVersionValueById(room.getId());

        CandidateItemDTO item = toCandidateItem(roomItem);
        eventPublisher.publishEvent(new ItemAddedEvent(
                room.getId(),
                roomVersion,
                principal.participantId(),
                item,
                toPlacements(roomItems)
        ));

        return new CandidateResponseDTO(
                roomItem.getId(), room.getId(), product.getId(),
                roomItem.getPosition(), null, roomItem.getUpdatedAt());
    }

    /** 후보 의상 삭제 → 컨트롤러에서 204 반환 */
    public void delete(Long roomId, Long productId, RoomPrincipal principal) {
        roomAccessValidator.requireParticipant(roomId, principal);

        Room room = roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        RoomItem roomItem = roomItemRepository.findByRoomIdAndProductId(roomId, productId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        Long roomItemId = roomItem.getId();

        roomItemRepository.delete(roomItem);

        if (roomRepository.incrementVersion(room.getId()) != 1) {
            throw new ApiException(ErrorCode.ROOM_NOT_FOUND);
        }
        Long roomVersion = roomRepository.findVersionValueById(room.getId());

        eventPublisher.publishEvent(new ItemRemovedEvent(
                room.getId(),
                roomVersion,
                principal.participantId(),
                roomItemId,
                productId
        ));
    }

    /** 후보 의상 목록 조회 */
    @Transactional(readOnly = true)
    public CandidateListResponseDTO list(Long roomId, RoomPrincipal principal) {
        roomAccessValidator.requireParticipant(roomId, principal);

        if (!roomRepository.existsById(roomId)) {
            throw new ApiException(ErrorCode.ROOM_NOT_FOUND);
        }
        List<CandidateItemDTO> items =
                roomItemRepository.findAllByRoomIdWithProduct(roomId).stream()
                        .map(this::toCandidateItem)
                        .toList();
        return new CandidateListResponseDTO(roomId, items.size(), items);
    }

    private Integer resolveNewPosition(List<RoomItem> unclassifiedItems) {
        if (unclassifiedItems.isEmpty()) {
            return POSITION_STEP;
        }
        int firstPosition = unclassifiedItems.getFirst().getPosition();
        return firstPosition >= 2 ? firstPosition / 2 : null;
    }

    private void reindexWithNewItemFirst(RoomItem newItem, List<RoomItem> unclassifiedItems) {
        newItem.setPosition(POSITION_STEP);
        for (int i = 0; i < unclassifiedItems.size(); i++) {
            unclassifiedItems.get(i).setPosition(POSITION_STEP * (i + 2));
        }
    }

    private CandidateItemDTO toCandidateItem(RoomItem roomItem) {
        Product product = roomItem.getProduct();
        return new CandidateItemDTO(
                roomItem.getId(),
                product.getId(),
                product.getName(),
                product.getBrand(),
                product.getPrice(),
                imageUrlResolver.resolve(product.getImageUrl()),
                roomItem.getPosition(),
                roomItem.getTier() != null ? roomItem.getTier().getId() : null
        );
    }

    private List<PlacementDTO> toPlacements(List<RoomItem> roomItems) {
        return roomItems.stream()
                .map(item -> new PlacementDTO(
                        item.getId(),
                        item.getTier() != null ? item.getTier().getId() : null,
                        item.getPosition()
                ))
                .toList();
    }
}
