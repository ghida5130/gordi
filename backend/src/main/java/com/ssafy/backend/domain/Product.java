package com.ssafy.backend.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "products",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_products_source_external",
                columnNames = {"source", "external_id"}
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "brand", nullable = false, length = 100)
    private String brand;

    // 상품 출처 (예: MUSINSA, COUPANG)
    @Column(name = "source", nullable = false, length = 50)
    private String source;

    // 출처 사이트에서의 원본 상품 ID
    @Column(name = "external_id", nullable = false, length = 255)
    private String externalProductId;

    @Column(name = "price", nullable = false)
    private Integer price;

    @Column(name = "category", nullable = false, length = 100)
    private String category;

    @Column(name = "subcategory", nullable = false, length = 100)
    private String subcategory;

    @Column(name = "image_url", nullable = false, length = 2048)
    private String imageUrl;

    @Column(name = "purchase_url", nullable = false, length = 2048)
    private String purchaseUrl;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "KRW";

    // 판매 상태 (추천 후보는 AVAILABLE 만 사용)
    @Builder.Default
    @Column(
            name = "availability",
            nullable = false,
            length = 50,
            columnDefinition = "varchar(50) not null default 'AVAILABLE'"
    )
    private String availability = ProductAvailability.AVAILABLE.name();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
