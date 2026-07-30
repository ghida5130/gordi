package com.ssafy.backend.repository;

import com.ssafy.backend.domain.Avatar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AvatarRepository extends JpaRepository<Avatar, Long> {

    /** 키·몸무게 둘 다 입력: 요청 구간 ±1 범위의 후보 프리셋 */
    List<Avatar> findByGenderAndHeightIdAndWeightIdOrderByBodyTypeAsc(
            String gender, Long heightId, Long weightId);

    /** 몸무게 미입력(0): 해당 성별·키 구간의 기본 프리셋 */
    Optional<Avatar> findFirstByGenderAndHeightIdAndDefaultAvatarTrue(
            String gender, Long heightId);
}