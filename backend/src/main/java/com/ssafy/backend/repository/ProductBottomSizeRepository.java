package com.ssafy.backend.repository;

import com.ssafy.backend.domain.ProductBottomSize;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductBottomSizeRepository extends JpaRepository<ProductBottomSize, Long> {
    List<ProductBottomSize> findAllByProductId(Long productId);
}
