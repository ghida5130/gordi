package com.ssafy.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UserRequestDTO {

    // Validation Group 인터페이스
    public interface existGroup {}    // 회원 가입 시 email 존재 확인
    public interface addGroup {}      // 회원 가입 시
    public interface passwordGroup {} // 비밀번호 변경 시
    public interface updateGroup {}   // 회원 수정 시
    public interface deleteGroup {}   // 회원 삭제 시

    @NotBlank(
            groups = {existGroup.class, addGroup.class, updateGroup.class, deleteGroup.class},
            message = "아이디는 필수 입력 항목입니다."
    )
    @Size(
            min = 4, max = 20,
            message = "아이디는 4자 이상 20자 이하로 입력해야 합니다.",
            groups = {existGroup.class, addGroup.class, updateGroup.class, deleteGroup.class}
    )
    private String email;

    @Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,20}$",
            message = "비밀번호는 8자 이상 20자 이하, 영문 대소문자, 숫자, 특수문자를 모두 포함해야 합니다.",
            groups = {addGroup.class, passwordGroup.class}
    )
    private String password;

    @NotBlank(
            groups = {addGroup.class, updateGroup.class},
            message = "닉네임은 필수 입력 항목입니다."
    )
    private String nickname;

    // 기본 생성자
    public UserRequestDTO() {
    }

    // 전체 생성자
    public UserRequestDTO(String email, String password, String nickname) {
        this.email = email;
        this.password = password;
        this.nickname = nickname;
    }

    // Getter
    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public String getNickname() {
        return nickname;
    }

    // Setter
    public void setEmail(String email) {
        this.email = email;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }
}