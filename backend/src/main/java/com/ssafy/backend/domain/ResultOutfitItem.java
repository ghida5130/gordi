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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "result_outfit_items",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_result_outfit_items_slot",
                        columnNames = {"result_id", "slot"}
                ),
                @UniqueConstraint(
                        name = "uk_result_outfit_items_product",
                        columnNames = {"result_id", "product_id"}
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class ResultOutfitItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "result_id", nullable = false)
    private Result result;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "rank", nullable = false)
    private Integer rank;

    @Column(name = "slot", nullable = false, length = 20)
    private String slot;
}
