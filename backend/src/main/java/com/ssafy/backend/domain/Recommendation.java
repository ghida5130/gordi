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
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "recommendations",
        indexes = @Index(name = "ix_recommendations_user_created_at", columnList = "user_id,created_at")
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "subcategory", length = 50)
    private String subcategory;

    @Column(name = "budget_min", nullable = false)
    private Integer budgetMin;

    @Column(name = "budget_max", nullable = false)
    private Integer budgetMax;

    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private String status = "READY";

    @Builder.Default
    @Column(name = "version", nullable = false)
    private Long version = 1L;

    @Column(name = "empty_reason", length = 50)
    private String emptyReason;

    @Column(name = "suggested_budget_min")
    private Integer suggestedBudgetMin;

    @Column(name = "suggested_budget_max")
    private Integer suggestedBudgetMax;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
