package com.ssafy.backend.domain;

import com.ssafy.backend.dto.UserRequestDTO;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userId;

    @Column(unique = true, nullable = false)
    private String email; // 로그인용 아이디

    private String password;

    @Column(length = 100)
    private String nickname;

    private String fcmToken;

    @CreationTimestamp // INSERT 시 자동으로 현재 시간 저장
    private LocalDateTime createdAt;

    // JPA 기본 생성자 (Protected)
    protected User() {
    }

    // 편의 생성자
    public User(String email, String password, String nickname, String fcmToken) {
        this.email = email;
        this.password = password;
        this.nickname = nickname;
        this.fcmToken = fcmToken;
    }

    // Builder 전용 생성자
    private User(Builder builder) {
        this.email = builder.email;
        this.password = builder.password;
        this.nickname = builder.nickname;
        this.fcmToken = builder.fcmToken;
    }

    // 정보 수정 메서드
    public void updateUser(UserRequestDTO dto) {
        this.nickname = dto.getNickname();
    }

    // Getter
    public Long getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public String getNickname() {
        return nickname;
    }

    public String getFcmToken() {
        return fcmToken;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    // Setter
    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public void setFcmToken(String fcmToken) {
        this.fcmToken = fcmToken;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // Builder 패턴
    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private String email;
        private String password;
        private String nickname;
        private String fcmToken;

        private Builder() {
        }

        public Builder email(String email) {
            this.email = email;
            return this;
        }

        public Builder password(String password) {
            this.password = password;
            return this;
        }

        public Builder nickname(String nickname) {
            this.nickname = nickname;
            return this;
        }

        public Builder fcmToken(String fcmToken) {
            this.fcmToken = fcmToken;
            return this;
        }

        public String getLEmail() {
            return email;
        }

        public String getPassword() {
            return password;
        }

        public String getNickname() {
            return nickname;
        }

        public String getFcmToken() {
            return fcmToken;
        }

        public User build() {
            return new User(this);
        }
    }
}