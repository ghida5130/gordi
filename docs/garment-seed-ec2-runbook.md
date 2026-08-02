# 의류 seed S3·MySQL EC2 실행 절차

이 절차는 내부 평가용 `gordi-product-seed-v1` 198건만 대상으로 한다.
데이터 bundle, 이미지, manifest, 자격 증명 env 파일은 Git에 넣지 않는다.

## 1. 사전 확인

운영 앱을 중지하거나 쓰기 트래픽이 없는 점검 시간을 확보한다. DB 자격 증명은
저장소 밖의 권한 `600` env 파일에 넣고, 명령 인자나 로그에 값을 출력하지
않는다. `MYSQL_HOST`는 Docker network의 `gordi-mysql`을 사용한다.

먼저 `products`, `recommendations`의 기존 행 수와 `gender IS NULL` 행 수를
읽기 전용으로 확인한다. 기존 행이 있는데 non-null gender migration이 아직
적용되지 않았다면 여기서 중단하고 별도 backfill·검증 후 재개한다.

```sql
SELECT COUNT(*) AS products_count FROM products;
SELECT COUNT(*) AS recommendations_count FROM recommendations;
SELECT COUNT(*) AS products_gender_null FROM products WHERE gender IS NULL;
SELECT COUNT(*) AS recommendations_gender_null
FROM recommendations
WHERE gender IS NULL;
```

## 2. bundle 전송과 검증

로컬에서 검증된 manifest와 198개 primary 파일만 tar로 묶는다. tar와 manifest
각각의 SHA-256을 기록하고 SSH/SCP로 EC2의 전용 임시 디렉터리에 전송한다.
EC2에서 해시를 다시 계산해 로컬 기록과 일치하는지 확인한다.

```bash
mkdir -p /tmp/gordi-garment-seed
chmod 700 /tmp/gordi-garment-seed
sha256sum -c /tmp/gordi-garment-seed/SHA256SUMS
chmod 600 /tmp/gordi-garment-seed/garment-seed.env
```

도구 이미지는 배포할 commit에서 다음처럼 만든다.

```bash
docker build \
  -f ai/Dockerfile.garment-tools \
  -t gordi-garment-tools:seed-v1 \
  ai
```

## 3. S3 사전검사와 업로드

env 파일에는 AWS 3개 값과 `GARMENT_S3_BUCKET`,
`GARMENT_IMAGE_BASE_URL`을 둔다. 버킷은 private이어야 하며 public ACL을
사용하지 않는다.

```bash
docker run --rm \
  --network app-network \
  --env-file /tmp/gordi-garment-seed/garment-seed.env \
  -v /tmp/gordi-garment-seed:/work:rw \
  gordi-garment-tools:seed-v1 \
  upload-s3 \
  --manifest /work/gordi-product-seed-v1.json \
  --dataset-root /work/dataset \
  --output /work/gordi-product-seed-v1-uploaded.json \
  --dry-run

docker run --rm \
  --network app-network \
  --env-file /tmp/gordi-garment-seed/garment-seed.env \
  -v /tmp/gordi-garment-seed:/work:rw \
  gordi-garment-tools:seed-v1 \
  upload-s3 \
  --manifest /work/gordi-product-seed-v1.json \
  --dataset-root /work/dataset \
  --output /work/gordi-product-seed-v1-uploaded.json
```

업로드 후 같은 명령에 `--dry-run`을 붙여 198개가 모두 skip 대상인지 확인한다.
이는 객체 크기와 `sha256` metadata를 다시 검사한다.

## 4. DB dry-run, 백업, apply

같은 env 파일에 `MYSQL_HOST=gordi-mysql`, `MYSQL_PORT=3306`,
`MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`를 둔다.

```bash
docker run --rm \
  --network app-network \
  --env-file /tmp/gordi-garment-seed/garment-seed.env \
  -v /tmp/gordi-garment-seed:/work:rw \
  gordi-garment-tools:seed-v1 \
  seed-db \
  --manifest /work/gordi-product-seed-v1-uploaded.json \
  --dry-run

docker run --rm \
  --network app-network \
  --env-file /tmp/gordi-garment-seed/garment-seed.env \
  -v /tmp/gordi-garment-seed:/work:rw \
  gordi-garment-tools:seed-v1 \
  seed-db \
  --manifest /work/gordi-product-seed-v1-uploaded.json \
  --apply \
  --backup-output /work/pre-apply-target-backup.json
```

도구는 신규 컬럼, `(source, external_id)` unique index, 두 사이즈 테이블을 먼저
검사한다. 대상 기존 행만 백업하고 198건을 하나의 트랜잭션으로 upsert한다.
각 대상 상품의 상·하의 사이즈만 삭제 후 재삽입하며, 검증 실패 시 rollback한다.

## 5. 검증과 멱등 재실행

다음 조건을 확인한다.

- `(MUSINSA, external_id)` 중복 0건
- 대상 상품 198건, 모두 `AVAILABLE`
- 남성 98건·여성 100건, TOP 98건·BOTTOM 100건
- 두 사이즈 테이블의 대상 행 합계 732건
- 모든 `image_url`이 `GARMENT_IMAGE_BASE_URL`로 시작

동일 manifest로 S3 실제 명령과 DB `--apply`를 한 번 더 실행한다. S3 신규
객체 0건, DB 상품·사이즈 총 증가 0건이어야 한다. 두 번째 DB 실행도 새 백업
파일명을 사용한다.

마지막으로 내부망에서 이미지 URL 198개 HEAD 요청, 백엔드 상품 조회, avatar
성별 또는 `UNISEX` 후보 필터, FastAPI `/internal/v1/recommendations/rank`
호출을 smoke test한다.

## 6. 정리

건수와 SHA-256만 담은 민감정보 없는 요약을 보관한다. 성공을 확인한 뒤 EC2의
원본 tar, 풀린 primary bundle, manifest 복사본, DB 백업 취급 정책에 따른
임시 백업, credential env 파일을 제거한다. credential 파일은 가능하면
`shred -u`로 제거하고, 남은 파일 권한과 shell history에 비밀값이 없는지
확인한다.
