# 의류 카탈로그 정비·S3 업로드·DB 적재 진행 상황 보고서

## 1. 보고 개요

| 항목 | 내용 |
|---|---|
| 보고 기준일 | 2026-07-31 |
| 작업 브랜치 | `ai/feat/garment-recommendation` |
| 작업 범위 | 추천 계약 정렬, 의류 데이터셋 v2, seed manifest, S3 uploader, MySQL seeder |
| Git 상태 | 구현 커밋 6개 완료, push하지 않음 |
| 외부 사용 정책 | 내부 평가 전용, 외부 저장소 반출 계획 없음 |

## 2. 종합 진행 상황

전체 코드 구현과 로컬 데이터 준비는 완료되었다. 기존 raw 데이터 465건을
네트워크 재수집 없이 v2로 재처리했고, 균형 선정된 198건의 primary 이미지를
검수하여 backend seed manifest와 EC2 전송용 bundle까지 생성했다.

로컬 Docker MySQL에는 동일 구조로 선 적재와 멱등 재실행 테스트를 완료했다.
실제 S3 업로드, EC2 MySQL 적재, 서비스 smoke test는 아직 실행하지 않았다.
외부 단계는 EC2 SSH 정보와 AWS·MySQL 자격 증명 제공 후 진행한다.

| 단계 | 상태 | 결과 |
|---|---|---|
| FastAPI 추천 순위 API | 완료 | 내부 인증, 요청·응답 계약, baseline ranker 구현 |
| Backend 성별·세부분류 계약 | 완료 | avatar 성별 기반 후보 필터와 enum 확장 |
| 데이터셋 v2 재처리 | 완료 | normalized 465건, primary 465장 |
| 198건 primary 수동검수 | 완료 | READY 198건, 거부 0건 |
| Seed manifest export | 완료 | 상품 198건, 사이즈 732행 |
| 멱등 S3 uploader | 완료 | dry-run, 재실행 skip, 충돌 방지 구현 |
| 트랜잭션 MySQL seeder | 완료 | schema 검사, 백업, rollback, 재실행 구현 |
| 로컬 Docker MySQL 선 적재 | 완료 | 198상품·732사이즈, 재실행 증가 0건 |
| EC2 S3·DB 실제 반영 | 대기 | 접속 정보와 자격 증명 필요 |
| 서비스 smoke test | 대기 | 실제 반영 완료 후 수행 |

## 3. 완료 커밋

| 커밋 | 내용 |
|---|---|
| `4ec63f2` | `feat(ai): add backend-compatible recommendation rank endpoint` |
| `4446cff` | `feat(recommendation): align catalog gender and subcategory contract` |
| `070ac6e` | `feat(ai): normalize primary-only garment dataset v2` |
| `16c28a5` | `feat(ai): export validated garment seed manifest` |
| `cc5d7d0` | `feat(ai): add idempotent S3 garment uploader` |
| `ce190f7` | `feat(ai): add transactional MySQL garment seeder` |

### 3.1 추천 API와 backend 계약

- FastAPI에 `POST /internal/v1/recommendations/rank`를 추가했다.
- 내부 API key 검증과 결정적 baseline ranker를 구현했다.
- 상품과 추천에 `gender`를 추가했다.
- 추천 생성 시 인증 사용자의 avatar 성별을 적용한다.
- avatar가 없으면 추천 생성을 `400 Bad Request`로 거부한다.
- 상품 후보는 같은 성별 또는 `UNISEX`만 포함한다.
- FastAPI에서도 전달된 후보의 성별을 다시 검증한다.
- TOP/BOTTOM 세부분류 enum을 현재 수집 데이터에 맞게 확장했다.

### 3.2 데이터셋 v2

- 기존 raw bundle 465건을 오프라인으로 재처리했다.
- 상품당 primary 이미지 한 장만 유지했다.
- alternate/detail 이미지는 v2 결과에서 제외했다.
- 이미지 판별값은 검수 전 `UNKNOWN/null`로 저장하도록 변경했다.
- `style_group_id="0"`은 `null`로 정규화했다.
- raw bundle SHA-256을 canonical JSON 기준으로 명확히 정의했다.
- 원본 한글 분류와 backend enum 코드를 함께 보존했다.
- 드레스는 `TOP/DRESS`, 세트는 첫 구성품 기준 임시분류를 유지했다.

## 4. 데이터 검증 결과

### 4.1 전체 v2 데이터

| 검증 항목 | 결과 |
|---|---:|
| Raw bundle | 465건 |
| Normalized record | 465건 |
| Primary 이미지 | 465장 |
| Alternate 이미지 | 0장 |
| 고아 이미지 | 0장 |
| 중복 primary hash | 0건 |
| 재처리 오류 | 0건 |

전체 465건 중 치수 요건을 충족하지 못한 188건은 `INVALID`, 나머지 277건은
이미지 검수 전 `REVIEW_REQUIRED` 상태로 생성되었다. 이 가운데 기존 균형 선정
파일에 포함된 198건을 별도로 수동검수했다.

### 4.2 1차 seed 198건

| 구분 | 건수 |
|---|---:|
| 남성 상의 | 48 |
| 남성 하의 | 50 |
| 여성 상의 | 50 |
| 여성 하의 | 50 |
| 남성 합계 | 98 |
| 여성 합계 | 100 |
| TOP 합계 | 98 |
| BOTTOM 합계 | 100 |
| 상품 합계 | 198 |
| 사이즈 행 | 732 |

Primary 검수 결과:

- 검수 완료: 198건
- `READY`: 198건
- 거부: 0건
- 상품 단독 이미지: 42건
- 착용 참고 이미지: 156건
- 후면: 11건
- 측면: 2건
- 상세: 1건

선정 ID 목록 SHA-256:

```text
f800b06eb4dd892b5605e452242e41625e9c74ba92cce75a3f96d797c0ae0eee
```

## 5. 구현된 적재 안전장치

### 5.1 S3 uploader

- 객체 key:
  `garments/musinsa/{external_id}/primary-{sha256-prefix}.{ext}`
- 업로드 전 모든 객체에 대해 `HeadObject`를 수행한다.
- 크기와 `sha256` metadata가 같으면 skip한다.
- 같은 key에 다른 내용이 있으면 업로드 전에 전체 작업을 실패시킨다.
- `Content-Type`, SHA-256 metadata, SSE-S3 `AES256`을 적용한다.
- public ACL을 사용하지 않는다.
- AWS 설정과 자격 증명은 환경변수로만 받는다.
- 업로드 후 고정 내부망 URL과 object key를 manifest에 기록한다.

### 5.2 MySQL seeder

- `products` 신규 컬럼과 non-null 조건을 검사한다.
- `(source, external_id)` unique index를 검사한다.
- 상의·하의 사이즈 테이블의 필수 구조를 검사한다.
- 실제 CLI는 상품 198건·사이즈 732행 manifest만 허용한다.
- apply 전에 대상 상품과 사이즈만 JSON으로 백업한다.
- 상품은 `(source, external_id)` 기준으로 upsert한다.
- 대상 상품의 상·하의 사이즈만 삭제 후 재삽입한다.
- 전체 198건을 하나의 트랜잭션으로 처리한다.
- 반영 후 대상 상품·사이즈 건수를 다시 확인한다.
- 오류가 발생하면 전체 트랜잭션을 rollback한다.

## 6. 테스트 및 품질 확인

| 검증 | 결과 |
|---|---|
| AI/FastAPI/collector 전체 테스트 | 18개 통과 |
| Python 문법 검사 | 통과 |
| `git diff --check` | 통과 |
| S3 신규 업로드 Stubber 테스트 | 통과 |
| S3 동일 객체 재실행 테스트 | 통과 |
| S3 객체 충돌 테스트 | 통과 |
| MySQL dry-run 무DML 테스트 | 통과 |
| MySQL rollback 테스트 | 통과 |
| MySQL 재실행 테스트 | 통과 |
| Tar 내부 primary hash 검증 | 198건 모두 일치 |
| 로컬 Docker MySQL dry-run | 198상품·732사이즈, 기존 0건 |
| 로컬 Docker MySQL 실제 적재 | 상품 198건·사이즈 732행 |
| 로컬 Docker MySQL 멱등 재실행 | 상품·사이즈 증가 0건 |

Backend는 Java 21 환경에서 추천 관련 대상 테스트가 통과했다. 전체 backend
테스트는 컴파일과 실행까지 완료했으나, 로컬 DB dialect/placeholder 환경에
의존하는 기존 context 테스트 6건이 실패했다. 이번 변경으로 인한 Java 컴파일
오류는 확인되지 않았다.

### 6.1 로컬 Docker MySQL 선 적재 결과

로컬 `gordi-mysql` 컨테이너의 기존 `products`, `recommendations`가 모두
0건이고 gender non-null 및 `(source, external_id)` unique index가 적용된
상태임을 확인한 후 실행했다.

| 항목 | 결과 |
|---|---:|
| MUSINSA 상품 | 198 |
| 고유 external ID | 198 |
| 중복 source/external ID | 0 |
| 남성 / 여성 | 98 / 100 |
| TOP / BOTTOM | 98 / 100 |
| AVAILABLE | 198 |
| 내부 URL 불일치 | 0 |
| 상의 사이즈 | 273 |
| 하의 사이즈 | 459 |
| 사이즈 합계 | 732 |
| 재실행 후 상품 / 사이즈 | 198 / 732 |

첫 컨테이너 dry-run에서 전용 requirements의 `httpx` 누락을 발견해 보완했다.
첫 apply에서는 로컬 schema의 `created_at`이 기본값 없는 non-null 컬럼이라
INSERT가 실패했으며, 전체 rollback되어 상품·사이즈가 모두 0건임을 확인했다.
Seeder가 `CURRENT_TIMESTAMP`를 명시하도록 수정한 뒤 실제 적재와 재실행이
통과했다.

## 7. 생성 산출물

산출물은 `.gitignore` 대상이며 Git에 포함되지 않는다.

| 산출물 | 경로·값 |
|---|---|
| Seed manifest | [`../ai/garment_dataset-v2/reports/gordi-product-seed-v1.json`](../ai/garment_dataset-v2/reports/gordi-product-seed-v1.json) |
| Manifest SHA-256 | `c51deaaf4a9667416830621f3b3e2388d53a4d00f18b9c31d3b96ec5c5b89855` |
| EC2 전송 bundle | [`../ai/garment_dataset-v2/reports/gordi-garment-seed-198.tar`](../ai/garment_dataset-v2/reports/gordi-garment-seed-198.tar) |
| Bundle 크기 | 48,486,400 bytes |
| Bundle 엔트리 | manifest 1개 + primary 198장 |
| Bundle SHA-256 | `00f4bd1725b5a9ce1717b95dfefb5e59172c527e6fa12093db5dfa2b6bdaedfc` |
| SHA 기록 파일 | [`../ai/garment_dataset-v2/reports/gordi-garment-seed-198.tar.sha256`](../ai/garment_dataset-v2/reports/gordi-garment-seed-198.tar.sha256) |
| EC2 실행 문서 | [`garment-seed-ec2-runbook.md`](garment-seed-ec2-runbook.md) |

## 8. 미진행 항목과 필요 입력

다음 항목은 실제 외부 시스템 상태를 변경하므로 아직 실행하지 않았다.

1. EC2의 기존 `products`, `recommendations` 행 수와 gender null 여부 확인
2. Bundle을 EC2 임시 디렉터리로 전송하고 SHA-256 재검증
3. S3 dry-run과 실제 업로드
4. S3 객체 198개 metadata 재검증
5. MySQL dry-run
6. 대상 기존 행 백업
7. MySQL 실제 적재와 트랜잭션 검증
8. 동일 작업 재실행 후 증가분 0건 확인
9. 이미지 URL, 상품 조회, 성별 후보 필터, FastAPI ranking smoke test
10. 원본 bundle과 credential env 파일 정리

진행에 필요한 입력:

- EC2 SSH host, port, user, 인증 방식
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `GARMENT_S3_BUCKET`
- `GARMENT_IMAGE_BASE_URL`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- 필요 시 `MYSQL_PORT` — 기본값 `3306`

## 9. 다음 실행 권장 순서

1. EC2·S3·MySQL 설정값을 저장소 밖의 권한 제한 env 파일로 준비한다.
2. EC2 DB의 기존 행과 gender migration 상태를 읽기 전용으로 점검한다.
3. 전송 bundle을 EC2로 옮기고 SHA-256을 확인한다.
4. 도구 컨테이너를 `app-network`에 연결해 S3 dry-run을 수행한다.
5. S3 실제 업로드 후 재검사한다.
6. 업로드된 manifest로 DB dry-run을 수행한다.
7. 대상 행 백업 후 DB apply를 수행한다.
8. S3와 DB를 각각 재실행해 멱등성을 확인한다.
9. backend와 FastAPI smoke test를 수행한다.
10. 민감정보와 임시 bundle을 제거하고 건수·해시 요약만 보관한다.
