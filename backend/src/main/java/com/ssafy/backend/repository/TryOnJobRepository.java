package com.ssafy.backend.repository;

import com.ssafy.backend.domain.TryOnJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TryOnJobRepository extends JpaRepository<TryOnJob, Long> {

    Optional<TryOnJob> findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(Long roomId);

    /**
     * 조회 API 용 단건 조회.
     * 권한 검증에 room / ownerUser / ownerParticipant 가 모두 필요하므로 함께 fetch 한다.
     */
    @Query("""
            select job from TryOnJob job
            left join fetch job.room
            left join fetch job.ownerUser
            left join fetch job.ownerParticipant
            where job.id = :jobId
            """)
    Optional<TryOnJob> findDetailById(@Param("jobId") Long jobId);

    /** 동일 요청 해시로 이미 성공한 Job (캐시 재사용 판정). 가장 최근 성공 건을 사용한다. */
    @Query("""
            select job from TryOnJob job
            where job.requestHash = :requestHash
              and job.status = 'SUCCEEDED'
            order by job.id desc
            limit 1
            """)
    Optional<TryOnJob> findLatestSucceededByRequestHash(@Param("requestHash") String requestHash);

    /** 요청자별 생성 한도 집계 */
    long countByOwnerUserIdAndCreatedAtGreaterThanEqual(Long ownerUserId, LocalDateTime from);

    /**
     * 콜백이 오지 않아 아직 끝나지 않은 Job (정합 복구 대상).
     * 오래 기다린 것부터 처리한다.
     */
    @Query("""
            select job.id from TryOnJob job
            where job.status in ('QUEUED', 'RUNNING')
              and job.createdAt < :threshold
            order by job.createdAt asc
            """)
    List<Long> findStaleJobIds(@Param("threshold") LocalDateTime threshold, Pageable pageable);
}
