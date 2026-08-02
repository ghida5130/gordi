package com.ssafy.backend.repository;

import com.ssafy.backend.domain.TryOnJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TryOnJobRepository extends JpaRepository<TryOnJob, Long> {

    Optional<TryOnJob> findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(Long roomId);
}
