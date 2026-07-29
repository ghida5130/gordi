package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    // 추천 접근 권한 확인: 해당 추천을 참조하는 방의 호스트인지
    boolean existsByRecommendationIdAndHostUserId(Long recommendationId, Long hostUserId);
}
