package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "product_top_sizes")
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class ProductTopSize {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "products_id", nullable = false)
    private Product product;

    @Column(name = "size_name", nullable = false, length = 50)
    private String sizeName;

    @Column(name = "total_length", precision = 8, scale = 2)
    private BigDecimal totalLength;

    @Column(name = "shoulder_width", precision = 8, scale = 2)
    private BigDecimal shoulderWidth;

    @Column(name = "chest_width", precision = 8, scale = 2)
    private BigDecimal chestWidth;

    @Column(name = "sleeve_length", precision = 8, scale = 2)
    private BigDecimal sleeveLength;
}
