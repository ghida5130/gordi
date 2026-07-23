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

    @Column(name = "loginId", nullable = false)
    private String loginId;

    @Column(name = "refresh", nullable = false, length = 512)
    private String refresh;

    @CreatedDate
    @Column(name = "created_date", updatable = false)
    private LocalDateTime createdDate;

    // JPA 기본 생성자 (Protected로 접근 제한)
    protected RefreshEntity() {
    }

    // 편의 생성자
    public RefreshEntity(String loginId, String refresh) {
        this.loginId = loginId;
        this.refresh = refresh;
    }

    // 전체 필드 생성자
    public RefreshEntity(Long id, String loginId, String refresh, LocalDateTime createdDate) {
        this.id = id;
        this.loginId = loginId;
        this.refresh = refresh;
        this.createdDate = createdDate;
    }

    // Builder 패턴용 전용 생성자
    private RefreshEntity(Builder builder) {
        this.id = builder.id;
        this.loginId = builder.loginId;
        this.refresh = builder.refresh;
        this.createdDate = builder.createdDate;
    }

    // Getter
    public Long getId() {
        return id;
    }

    public String getLoginId() {
        return loginId;
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

    public void setLoginId(String loginId) {
        this.loginId = loginId;
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
        private String loginId;
        private String refresh;
        private LocalDateTime createdDate;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder loginId(String loginId) {
            this.loginId = loginId;
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