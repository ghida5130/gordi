package com.ssafy.backend.repository;

import com.ssafy.backend.domain.ProductTopSize;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductTopSizeRepository extends JpaRepository<ProductTopSize, Long> {
    List<ProductTopSize> findAllByProductId(Long productId);
}