# Frontend Service

본 모노레포의 프론트엔드 서비스 파트입니다.

## 테스트 설명
* `main` 브랜치로 push하더라도, 백엔드 전용 Jenkins 파이프라인(`gordi-backend`)에서는 **`changeset` 조건에 의해 빌드가 Skip**되어야 합니다.

## 실행 가이드
* Target Branch: `main`
* Trigger Path: `frontend/**`