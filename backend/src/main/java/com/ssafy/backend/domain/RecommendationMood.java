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
        name = "recommendation_moods",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_recommendation_moods_code",
                        columnNames = {"recommendation_id", "mood_code"}
                ),
                @UniqueConstraint(
                        name = "uk_recommendation_moods_position",
                        columnNames = {"recommendation_id", "position"}
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class RecommendationMood {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_id", nullable = false)
    private Recommendation recommendation;

    @Column(name = "mood_code", nullable = false, length = 30)
    private String moodCode;

    @Column(name = "position", nullable = false)
    private Integer position;
}
