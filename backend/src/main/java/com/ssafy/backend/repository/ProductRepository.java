package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Product;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    // 예산 범위 안의 판매 가능 상품 조회 (subcategory 는 선택값)
    @Query("""
            SELECT p FROM Product p
            WHERE p.availability = 'AVAILABLE'
              AND p.category = :category
              AND (:subcategory IS NULL OR p.subcategory = :subcategory)
              AND p.price BETWEEN :budgetMin AND :budgetMax
            ORDER BY p.price ASC
            """)
    List<Product> findMatching(
            @Param("category") String category,
            @Param("subcategory") String subcategory,
            @Param("budgetMin") Integer budgetMin,
            @Param("budgetMax") Integer budgetMax,
            Pageable pageable
    );

    // 재추천용: 이미 노출된 상품을 제외한 후보 조회 (excludedIds 는 비어 있지 않아야 함)
    @Query("""
            SELECT p FROM Product p
            WHERE p.availability = 'AVAILABLE'
              AND p.category = :category
              AND (:subcategory IS NULL OR p.subcategory = :subcategory)
              AND p.price BETWEEN :budgetMin AND :budgetMax
              AND p.id NOT IN :excludedIds
            ORDER BY p.price ASC
            """)
    List<Product> findMatchingExcluding(
            @Param("category") String category,
            @Param("subcategory") String subcategory,
            @Param("budgetMin") Integer budgetMin,
            @Param("budgetMax") Integer budgetMax,
            @Param("excludedIds") Collection<Long> excludedIds,
            Pageable pageable
    );

    // 예산 범위 밖일 때 추천할 최소 가격 (subcategory 는 선택값)
    @Query("""
            SELECT MIN(p.price) FROM Product p
            WHERE p.availability = 'AVAILABLE'
              AND p.category = :category
              AND (:subcategory IS NULL OR p.subcategory = :subcategory)
            """)
    Integer findMinPrice(
            @Param("category") String category,
            @Param("subcategory") String subcategory
    );

    // 예산 범위 밖일 때 추천할 최대 가격 (subcategory 는 선택값)
    @Query("""
            SELECT MAX(p.price) FROM Product p
            WHERE p.availability = 'AVAILABLE'
              AND p.category = :category
              AND (:subcategory IS NULL OR p.subcategory = :subcategory)
            """)
    Integer findMaxPrice(
            @Param("category") String category,
            @Param("subcategory") String subcategory
    );
}
