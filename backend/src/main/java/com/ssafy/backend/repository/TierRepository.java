package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Tier;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TierRepository extends JpaRepository<Tier, Long> {
}
