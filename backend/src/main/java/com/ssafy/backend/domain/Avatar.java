package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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
        name = "avatars",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_avatars_preset_version",
                columnNames = {"gender_presentation", "body_build", "body_proportion", "version"}
        ),
        indexes = @Index(
                name = "ix_avatars_active_filter",
                columnList = "gender_presentation,is_active,is_default"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Avatar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "gender_presentation", nullable = false, length = 20)
    private String genderPresentation;

    @Column(name = "body_build", nullable = false, length = 20)
    private String bodyBuild;

    @Column(name = "body_proportion", nullable = false, length = 20)
    private String bodyProportion;

    @Column(name = "image_url", nullable = false, length = 1000)
    private String imageUrl;

    @Builder.Default
    @Column(name = "version", nullable = false)
    private Integer version = 1;

    @Builder.Default
    @Column(name = "is_default", nullable = false)
    private boolean defaultAvatar = false;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
