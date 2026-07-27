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
        name = "result_tiers",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_result_tiers_position",
                columnNames = {"result_id", "position"}
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class ResultTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "result_id", nullable = false)
    private Result result;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_tier_id")
    private Tier sourceTier;

    @Column(name = "name", nullable = false, length = 30)
    private String name;

    @Column(name = "position", nullable = false)
    private Integer position;
}
