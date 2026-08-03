package com.ssafy.backend.repository;

import com.ssafy.backend.domain.TryOnJobEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TryOnJobEventRepository extends JpaRepository<TryOnJobEvent, Long> {

    /** 같은 Job 에 같은 이벤트가 이미 수신됐는지 (콜백 재전송 판정) */
    boolean existsByTryOnJobIdAndEventId(Long tryOnJobId, String eventId);
}
