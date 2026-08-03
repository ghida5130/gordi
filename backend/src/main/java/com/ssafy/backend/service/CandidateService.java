package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.util.ImageUrlResolver;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.dto.candidate.CandidateAddRequestDTO;
import com.ssafy.backend.dto.candidate.CandidateListResponseDTO;
import com.ssafy.backend.dto.candidate.CandidateResponseDTO;
import com.ssafy.backend.repository.ProductRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CandidateService {

    private final RoomItemRepository roomItemRepository;
    private final RoomRepository roomRepository;
    private final ProductRepository productRepository;
    private final RoomAccessValidator roomAccessValidator;
    private final ImageUrlResolver imageUrlResolver;

    /** 후보 의상 추가: product를 room에 넣는다 */
    public CandidateResponseDTO add(CandidateAddRequestDTO request, RoomPrincipal principal) {
        roomAccessValidator.requireParticipant(request.roomId(), principal);

        Room room = roomRepository.findById(request.roomId())
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        if (roomItemRepository.existsByRoomIdAndProductId(room.getId(), product.getId())) {
            throw new ApiException(ErrorCode.CONFLICT);
        }

        RoomItem roomItem = roomItemRepository.save(RoomItem.builder()
                .room(room)
                .product(product)
                .position(0)
                .build());

        return new CandidateResponseDTO(
                roomItem.getId(), room.getId(), product.getId(),
                roomItem.getPosition(), null, roomItem.getUpdatedAt());
    }

    /** 후보 의상 삭제 → 컨트롤러에서 204 반환 */
    public void delete(Long roomId, Long productId, RoomPrincipal principal) {
        roomAccessValidator.requireParticipant(roomId, principal);

        RoomItem roomItem = roomItemRepository.findByRoomIdAndProductId(roomId, productId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        roomItemRepository.delete(roomItem);
    }

    /** 후보 의상 목록 조회 */
    @Transactional(readOnly = true)
    public CandidateListResponseDTO list(Long roomId, RoomPrincipal principal) {
        roomAccessValidator.requireParticipant(roomId, principal);

        if (!roomRepository.existsById(roomId)) {
            throw new ApiException(ErrorCode.ROOM_NOT_FOUND);
        }
        List<CandidateListResponseDTO.Item> items =
                roomItemRepository.findAllByRoomIdWithProduct(roomId).stream()
                        .map(ri -> new CandidateListResponseDTO.Item(
                                ri.getId(),
                                ri.getProduct().getId(),
                                ri.getProduct().getName(),
                                ri.getProduct().getBrand(),
                                ri.getProduct().getPrice(),
                                imageUrlResolver.resolve(ri.getProduct().getImageUrl()),
                                ri.getPosition(),
                                ri.getTier() != null ? ri.getTier().getId() : null))
                        .toList();
        return new CandidateListResponseDTO(roomId, items.size(), items);
    }
}
