package com.ssafy.backend.repository;

import com.ssafy.backend.domain.ProductTopSize;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductTopSizeRepository extends JpaRepository<ProductTopSize, Long> {
    List<ProductTopSize> findAllByProductId(Long productId);

    /** 착장 요청이 고른 사이즈의 실측 행 */
    Optional<ProductTopSize> findByProductIdAndSizeName(Long productId, String sizeName);
}