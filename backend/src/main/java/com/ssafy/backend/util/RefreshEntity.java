package com.ssafy.backend.util;

import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "jwt_refresh_entity")
public class RefreshEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "refresh", nullable = false, length = 512)
    private String refresh;

    @CreatedDate
    @Column(name = "created_date", updatable = false)
    private LocalDateTime createdDate;

    // JPA 기본 생성자 (Protected로 접근 제한)
    protected RefreshEntity() {
    }

    // 편의 생성자
    public RefreshEntity(String email, String refresh) {
        this.email = email;
        this.refresh = refresh;
    }

    // 전체 필드 생성자
    public RefreshEntity(Long id, String email, String refresh, LocalDateTime createdDate) {
        this.id = id;
        this.email = email;
        this.refresh = refresh;
        this.createdDate = createdDate;
    }

    // Builder 패턴용 전용 생성자
    private RefreshEntity(Builder builder) {
        this.id = builder.id;
        this.email = builder.email;
        this.refresh = builder.refresh;
        this.createdDate = builder.createdDate;
    }

    // Getter
    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getRefresh() {
        return refresh;
    }

    public LocalDateTime getCreatedDate() {
        return createdDate;
    }

    // Setter
    public void setId(Long id) {
        this.id = id;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setRefresh(String refresh) {
        this.refresh = refresh;
    }

    public void setCreatedDate(LocalDateTime createdDate) {
        this.createdDate = createdDate;
    }

    // Builder 메서드
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private String email;
        private String refresh;
        private LocalDateTime createdDate;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder email(String email) {
            this.email = email;
            return this;
        }

        public Builder refresh(String refresh) {
            this.refresh = refresh;
            return this;
        }

        public Builder createdDate(LocalDateTime createdDate) {
            this.createdDate = createdDate;
            return this;
        }

        public RefreshEntity build() {
            return new RefreshEntity(this);
        }
    }
}