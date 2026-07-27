package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "product_bottom_sizes",
        indexes = @Index(name = "ix_product_bottom_sizes_product", columnList = "products_id")
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class ProductBottomSize {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "products_id", nullable = false)
    private Product product;

    @Column(name = "size_name", nullable = false, length = 50)
    private String sizeName;

    @Column(name = "total_length", precision = 5, scale = 1)
    private BigDecimal totalLength;

    @Column(name = "waist_width", precision = 5, scale = 1)
    private BigDecimal waistWidth;

    @Column(name = "hip_width", precision = 5, scale = 1)
    private BigDecimal hipWidth;

    @Column(name = "thigh_width", precision = 5, scale = 1)
    private BigDecimal thighWidth;

    @Column(name = "rise", precision = 5, scale = 1)
    private BigDecimal rise;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
