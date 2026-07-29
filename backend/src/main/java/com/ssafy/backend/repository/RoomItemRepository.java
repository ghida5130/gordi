package com.ssafy.backend.repository;

import com.ssafy.backend.domain.RoomItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomItemRepository extends JpaRepository<RoomItem, Long> {

    long countByRoomId(Long roomId);
}
