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

@Entity
@Table(name = "avatars")
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

    @Column(name = "gender_presentation", nullable = false, length = 50)
    private String genderPresentation;

    @Column(name = "body_build", nullable = false, length = 50)
    private String bodyBuild;

    @Column(name = "body_proportion", nullable = false, length = 50)
    private String bodyProportion;

    @Column(name = "image_url", nullable = false, length = 2048)
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
}
