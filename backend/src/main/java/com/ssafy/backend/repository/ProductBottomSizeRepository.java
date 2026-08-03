package com.ssafy.backend.repository;

import com.ssafy.backend.domain.ProductBottomSize;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductBottomSizeRepository extends JpaRepository<ProductBottomSize, Long> {
    List<ProductBottomSize> findAllByProductId(Long productId);

    /** 착장 요청이 고른 사이즈의 실측 행 */
    Optional<ProductBottomSize> findByProductIdAndSizeName(Long productId, String sizeName);
}
