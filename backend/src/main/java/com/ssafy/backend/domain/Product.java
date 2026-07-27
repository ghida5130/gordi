package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "products",
        indexes = @Index(
                name = "ix_products_recommendation_filter",
                columnList = "availability,category,subcategory,price"
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

    @Column(name = "brand", length = 100)
    private String brand;

    @Column(name = "price", nullable = false)
    private Integer price;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "subcategory", length = 50)
    private String subcategory;

    @Column(name = "image_url", nullable = false, length = 1000)
    private String imageUrl;

    @Column(name = "purchase_url", nullable = false, length = 1000)
    private String purchaseUrl;

    @Lob
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    @Column(name = "availability", nullable = false, length = 20)
    private String availability = "AVAILABLE";

    @Column(name = "color_group", length = 30)
    private String colorGroup;

    @Builder.Default
    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "KRW";

    @Column(name = "source_hash", length = 100)
    private String sourceHash;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
