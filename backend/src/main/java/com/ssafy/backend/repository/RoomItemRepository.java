package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RoomItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RoomItemRepository extends JpaRepository<RoomItem, Long> {

    long countByRoomId(Long roomId);

    boolean existsByRoomIdAndProductId(Long roomId, Long productId);
    Optional<RoomItem> findByRoomIdAndProductId(Long roomId, Long productId);

    @Query("select ri from RoomItem ri join fetch ri.product where ri.room.id = :roomId order by ri.position asc")
    List<RoomItem> findAllByRoomIdWithProduct(Long roomId);

    List<RoomItem> findAllByRoomIdOrderByPositionAsc(Long roomId);

    @Query("select coalesce(max(ri.position), 0) from RoomItem ri where ri.room.id = :roomId")
    int findMaxPosition(Long roomId);
}
