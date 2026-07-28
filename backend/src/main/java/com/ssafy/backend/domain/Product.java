package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "products")
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

    @Column(name = "color_group", length = 50)
    private String colorGroup;

    @Builder.Default
    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "KRW";

    @Column(name = "source_hash", length = 255)
    private String sourceHash;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
