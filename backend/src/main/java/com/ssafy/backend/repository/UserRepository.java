package com.ssafy.backend.repository;

import com.ssafy.backend.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // 회원가입 시 로그인 아이디 중복 검증
    Boolean existsByEmail(String email);

    // 로그인 및 회원정보 조회/수정 시 아이디로 유저 검색
    Optional<User> findByEmail(String email);

    // 회원 탈퇴 시 아이디 기준 삭제
    void deleteByEmail(String email);

}