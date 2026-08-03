# 의상 데이터 수집 규약 v1

- 문서 버전: 1.1.0
- 제정일: 2026-07-29
- 개정일: 2026-08-01
- 적용 범위: GORDI MVP 사전구축 의상 데이터
- 저장 형태: 상품별 JSON 원본과 로컬 이미지
- 기본 단위: 길이 `cm`, 가격 `KRW`

## 1. 목적

이 규약은 가상 피팅 및 의상 추천에 사용할 상품 이미지와 사이즈 실측 데이터를
일관된 형태로 수집·검증·보관하기 위한 기준을 정의한다.

수집 데이터는 다음 용도로 사용한다.

1. MVP 상품 DB 사전구축
2. 선택 사이즈와 아바타 체형을 비교하는 동적 핏 계산
3. 이미지 생성 모델에 전달할 의상 레퍼런스 구성
4. 데이터 변경·중복·출처 추적

수집 원본은 현재 DB 컬럼에 맞춰 정보를 버리지 않는다. 원본 JSON을 충분한 정보로
보존한 뒤, 검증된 필드만 정규화하여 DB에 적재한다.

## 2. 기본 원칙

### 2.1 출처와 허용 범위

- 자동 수집 전 대상 사이트의 이용약관, `robots.txt`, API 정책을 확인한다.
- 자동 수집이 차단된 사이트는 명시적인 허가, 제휴 API 또는 상품 피드 없이
  크롤링하지 않는다.
- 로그인, CAPTCHA, 접근 제한 또는 봇 차단을 우회하지 않는다.
- 허용된 API가 있으면 HTML 파싱보다 API를 우선한다.
- 개인 계정 세션이나 비공개 데이터에 의존하지 않는다.
- 상품 이미지 사용 권리는 크롤링 허용 여부와 별도로 확인한다.
- 권리가 확인되지 않은 이미지는 `internal-evaluation-only-unverified` 상태로만
  보관하고 외부 공개·재배포·학습 데이터 전환을 금지한다.

무신사의 일반 크롤러 접근 정책은 수집 실행 전에
[공식 robots.txt](https://www.musinsa.com/robots.txt)에서 다시 확인한다.

### 2.2 최소 수집

- 가상 피팅과 상품 노출에 필요한 정보만 수집한다.
- 리뷰 작성자, 구매자 체형, 닉네임, 프로필 이미지 등 개인정보와 사용자 생성
  콘텐츠는 수집하지 않는다.
- 문의, 리뷰, 스냅 이미지, 코디 게시물은 기본 수집 범위에서 제외한다.
- 품절·가격·재고처럼 자주 변하는 값은 사실값과 확인 시각을 함께 저장한다.

### 2.3 원본과 정규화 데이터 분리

데이터는 다음 세 단계로 구분한다.

1. `RAW`: 출처에서 수집한 원본 값과 원본 URL
2. `VALIDATED`: 형식, 이미지, 단위와 필수 필드 검증을 통과한 데이터
3. `READY`: 수동 검수까지 통과하여 DB에 적재 가능한 데이터

원본을 수정하지 않고 정규화 결과를 별도 필드 또는 별도 파일로 생성한다.

## 3. 수집 단위와 식별자

### 3.1 상품 식별

상품의 기본 식별자는 다음 조합이다.

```text
source + external_product_id
```

예시:

```text
MUSINSA:5313017
```

- 같은 상품의 색상별 상품 번호가 다르면 별도 상품으로 저장한다.
- 색상 변형 관계를 확인할 수 있으면 `style_group_id`로 연결한다.
- 상품명이나 URL만으로 중복 여부를 판단하지 않는다.
- DB에는 `(source, external_product_id)` 복합 유니크 제약을 적용한다.

### 3.2 수집 실행 식별

모든 수집 실행에는 다음 정보를 기록한다.

- `collector_name`
- `collector_version`
- `collection_method`
- `collected_at`
- `last_seen_at`
- `raw_content_sha256`

`collection_method`는 다음 값 중 하나를 사용한다.

- `authorized-api`
- `authorized-feed`
- `manual-entry`
- `manual-browser-review`
- `brand-provided`

## 4. 상품 메타데이터 기준

### 4.1 필수 필드

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `source` | 문자열 | 데이터 출처 |
| `external_product_id` | 문자열 | 출처 사이트 상품 ID |
| `product_url` | URL | 공식 상품 상세 URL |
| `name` | 문자열 | 상품명 |
| `brand` | 문자열 | 브랜드명 |
| `gender` | 열거형 | `FEMALE`, `MALE`, `UNISEX` |
| `slot` | 열거형 | `TOP`, `BOTTOM`, `OUTER`, `DRESS` |
| `category` | 문자열 | 정규화 대분류 |
| `subcategory` | 문자열 | 정규화 소분류 |
| `currency` | 문자열 | 기본값 `KRW` |
| `images` | 배열 | 한 개 이상의 검증된 이미지 |
| `sizes` | 배열 | 한 개 이상의 사이즈 실측 행 |
| `collected_at` | ISO 8601 | 최초 수집 시각 |
| `last_seen_at` | ISO 8601 | 마지막 확인 시각 |

### 4.2 선택 필드

| 필드 | 설명 |
| --- | --- |
| `style_code` | 제조사 또는 브랜드 품번 |
| `style_group_id` | 색상 변형 상품 묶음 |
| `price_krw` | 확인 시점 판매가 |
| `original_price_krw` | 할인 전 가격 |
| `color_name` | 출처 표기 색상명 |
| `color_group` | 정규화 색상 그룹 |
| `season` | 출처가 제공하는 시즌 |
| `material` | 공식 표기 소재 |
| `description` | 이미지 생성에 사용할 객관적 의상 설명 |
| `sale_status` | `ON_SALE`, `SOLD_OUT`, `DISCONTINUED`, `UNKNOWN` |

### 4.3 상품 설명 작성 규칙

`description`은 이미지에 보이는 의상 정보만 객관적으로 작성한다.

포함할 수 있는 정보:

- 색상
- 로고와 그래픽
- 패턴
- 넥라인과 칼라
- 소매 형태와 길이
- 기장
- 포켓
- 여밈
- 주름, 턱, 절개, 봉제 구조
- 소재의 시각적 특성

제외할 정보:

- “예쁜”, “트렌디한” 같은 주관적 표현
- 구매 유도 문구
- 모델 신체와 외모 설명
- 사진 배경과 포즈 설명
- 할인, 배송, 리뷰 정보
- 검증되지 않은 소재·핏 추정

## 5. 카테고리 기준

### 5.1 슬롯

| 슬롯 | 포함 예시 |
| --- | --- |
| `TOP` | 티셔츠, 셔츠, 블라우스, 니트, 후드 |
| `BOTTOM` | 데님, 슬랙스, 카고 팬츠, 스커트 |
| `OUTER` | 재킷, 코트, 점퍼, 패딩, 가디건 |
| `DRESS` | 원피스, 점프수트 |

### 5.2 분류 원칙

- 한 상품에는 하나의 주 슬롯만 부여한다.
- 세트 상품은 구성품별 이미지와 실측을 분리할 수 없으면 제외한다.
- 원피스는 `DRESS`로 분류하며 `TOP`과 `BOTTOM`으로 중복 저장하지 않는다.
- 가디건처럼 상의와 아우터 경계가 모호한 상품은 출처 대분류를 우선하고
  결정 근거를 `classification_note`에 기록한다.

## 6. 이미지 수집 기준

### 6.1 이미지 우선순위

상품별 대표 이미지는 다음 순서로 선택한다.

1. 정면 상품 단독컷
2. 마네킹 또는 행거 정면컷
3. 얼굴이 보이지 않는 착용컷
4. 일반 인물 착용컷

상품 단독컷이 없어 착용컷을 사용할 경우 해당 사실을 반드시 기록한다.

### 6.2 필수 이미지 메타데이터

| 필드 | 설명 |
| --- | --- |
| `local_path` | 저장소 내부 상대 경로 |
| `source_url` | 원본 이미지 URL |
| `role` | `PRIMARY`, `ALTERNATE`, `DETAIL` |
| `view` | `FRONT`, `BACK`, `SIDE`, `DETAIL`, `UNKNOWN` |
| `reference_type` | `product-only`, `worn-reference` |
| `model_present` | 인물 포함 여부 |
| `other_garments_present` | 다른 의상 노출 여부 |
| `width` | 실제 픽셀 너비 |
| `height` | 실제 픽셀 높이 |
| `mime_type` | `image/jpeg`, `image/png`, `image/webp` |
| `byte_size` | 파일 크기 |
| `sha256` | 이미지 내용 해시 |

### 6.3 품질 기준

- 대표 이미지는 너비 1000px 이상을 권장한다.
- 최소 허용 크기는 가로·세로 각각 500px이다.
- 이미지 비율을 임의로 늘리거나 찌그러뜨리지 않는다.
- 썸네일을 확대하여 원본처럼 저장하지 않는다.
- 심하게 잘렸거나 상품 전체 형태를 확인할 수 없는 이미지는 대표 이미지로
  사용하지 않는다.
- 이미지 위에 큰 워터마크, 가격, 이벤트 문구가 있으면 제외한다.
- 여러 상품이 한 장에 섞인 이미지 시트는 대표 이미지에서 제외한다.
- 파일 확장자가 아니라 실제 MIME 형식을 검사한다.
- 이미지 디코딩에 실패하면 저장하지 않는다.

### 6.4 레퍼런스 유형 판정

`product-only`:

- 사람의 얼굴, 피부 또는 신체가 보이지 않는다.
- 다른 의상과의 코디가 포함되지 않는다.
- 행거, 바닥, 투명 마네킹은 허용한다.

`worn-reference`:

- 사람의 얼굴·피부·신체 일부가 보인다.
- 다른 상의·하의·아우터가 함께 보인다.
- 착용 마네킹의 신체 형태가 뚜렷하게 드러난다.

판정이 모호하면 더 보수적인 `worn-reference`로 저장한다.

## 7. 사이즈와 실측 수집 기준

### 7.1 공통 원칙

- 출처가 제공하는 모든 판매 사이즈 행을 수집한다.
- 선택 가능한 사이즈가 아니더라도 공식 실측표에 있으면 수집할 수 있다.
- 값이 없는 필드는 추정하지 않고 `null`로 저장한다.
- `-`, `상세 참조`, `업체 문의`는 숫자 `0`으로 변환하지 않는다.
- 범위값은 임의로 평균 내지 않고 원문을 `raw_value`에 보존한다.
- 단위가 명시되지 않으면 자동으로 `cm`라고 가정하지 않는다.
- 단면과 둘레를 구분하고 `measurement_basis`를 기록한다.
- 소수점은 원본 정밀도를 유지하며 DB 적재 시 최대 소수 둘째 자리까지 저장한다.

`measurement_basis`:

- `flat-width`: 단면 실측
- `circumference`: 둘레 실측
- `mixed`: 필드별 기준이 다름
- `unknown`: 확인 불가

### 7.2 상의·아우터 필드

| 필드 | 필수 여부 | 정의 |
| --- | --- | --- |
| `total_length` | 필수 | 목점 또는 어깨점부터 밑단 |
| `shoulder_width` | 필수 | 좌우 어깨점 직선거리 |
| `chest_width` | 필수 | 겨드랑이 아래 가슴 단면 |
| `sleeve_length` | 선택 | 어깨선부터 소매 끝 |
| `hem_width` | 선택 | 밑단 단면 |

상의와 아우터는 `total_length`, `shoulder_width`, `chest_width`가 모두 없으면
`READY` 상태로 전환하지 않는다.

### 7.3 하의 필드

| 필드 | 필수 여부 | 정의 |
| --- | --- | --- |
| `total_length` | 필수 | 허리선부터 밑단 |
| `waist_width` | 필수 | 자연 상태 허리 단면 |
| `hip_width` | 필수 | 엉덩이의 가장 넓은 지점 단면 |
| `thigh_width` | 선택 | 밑위 아래 허벅지 단면 |
| `rise` | 선택 | 앞 밑위 기준 |
| `inseam` | 선택 | 가랑이부터 밑단 |
| `hem_width` | 선택 | 밑단 단면 |

하의는 `total_length`, `waist_width`, `hip_width`가 모두 없으면 `READY` 상태로
전환하지 않는다.

### 7.4 원피스 필드

| 필드 | 필수 여부 |
| --- | --- |
| `total_length` | 필수 |
| `chest_width` | 필수 |
| `waist_width` | 필수 |
| `hip_width` | 필수 |
| `shoulder_width` | 선택 |
| `sleeve_length` | 선택 |
| `hem_width` | 선택 |

### 7.5 이상치 처리

다음 값은 자동 확정하지 않고 `REVIEW_REQUIRED`로 보낸다.

- 길이가 `0` 이하인 경우
- 의류 실측이 `250cm`를 초과하는 경우
- 같은 상품에서 사이즈가 커졌는데 주요 단면이 크게 감소하는 경우
- 동일 사이즈명이 중복되며 실측이 서로 다른 경우
- 하의 밑단이 허벅지보다 비정상적으로 큰 경우
- 상의 가슴단면과 어깨너비가 뒤바뀐 것으로 의심되는 경우

이상치는 원본 페이지와 대조한 뒤 수정하며 자동 보간하지 않는다.

## 8. JSON 저장 규격

상품별로 하나의 JSON 파일을 사용한다.

```json
{
  "schema_version": "garment-dataset-v1",
  "source": {
    "name": "MUSINSA",
    "external_product_id": "5313017",
    "product_url": "https://www.musinsa.com/products/5313017",
    "collection_method": "authorized-feed",
    "collector_name": "gordi-garment-collector",
    "collector_version": "1.0.0",
    "collected_at": "2026-07-29T10:00:00+09:00",
    "last_seen_at": "2026-07-29T10:00:00+09:00",
    "rights_status": "internal-evaluation-only-unverified"
  },
  "product": {
    "name": "상품명",
    "brand": "브랜드",
    "style_code": null,
    "style_group_id": null,
    "price_krw": 59900,
    "original_price_krw": null,
    "currency": "KRW",
    "gender": "FEMALE",
    "slot": "BOTTOM",
    "category": "PANTS",
    "subcategory": "BOOTCUT",
    "color_name": "블랙",
    "color_group": "BLACK",
    "season": null,
    "material": null,
    "description": "블랙 카고 포켓과 자수 장식이 있는 부츠컷 팬츠",
    "sale_status": "ON_SALE"
  },
  "images": [
    {
      "local_path": "images/musinsa/5313017/primary.jpg",
      "source_url": "https://example.com/image.jpg",
      "role": "PRIMARY",
      "view": "FRONT",
      "reference_type": "worn-reference",
      "model_present": true,
      "other_garments_present": true,
      "width": 1200,
      "height": 1500,
      "mime_type": "image/jpeg",
      "byte_size": 123456,
      "sha256": "..."
    }
  ],
  "sizes": [
    {
      "size_name": "S",
      "measurement_basis": "flat-width",
      "measurements_cm": {
        "total_length": 103,
        "shoulder_width": null,
        "chest_width": null,
        "waist_width": 36,
        "hip_width": 47,
        "thigh_width": 30,
        "sleeve_length": null,
        "rise": 26,
        "inseam": null,
        "hem_width": 30
      }
    }
  ],
  "validation": {
    "status": "READY",
    "validated_at": "2026-07-29T10:10:00+09:00",
    "reviewer": null,
    "warnings": []
  }
}
```

## 9. 파일 저장 규칙

권장 디렉터리 구조:

```text
garment_dataset/
├─ raw/
│  └─ musinsa/
│     └─ 5313017/
│        ├─ source.json
│        └─ raw-metadata.json
├─ images/
│  └─ musinsa/
│     └─ 5313017/
│        ├─ primary.jpg
│        ├─ alternate-01.jpg
│        └─ detail-01.jpg
├─ normalized/
│  └─ musinsa/
│     └─ 5313017.json
└─ reports/
   ├─ validation-summary.json
   └─ duplicates.json
```

파일명 규칙:

- 소문자 영문, 숫자, 하이픈만 사용한다.
- 출처 상품 ID를 임의로 변경하지 않는다.
- 대표 이미지는 `primary.ext`로 저장한다.
- 보조 이미지는 `alternate-NN.ext`, 상세컷은 `detail-NN.ext`로 저장한다.
- 원본 확장자보다 실제 MIME 형식에 맞는 확장자를 사용한다.

## 10. 중복과 변경 감지

### 10.1 상품 중복

1차 기준은 `(source, external_product_id)`이다.

추가 중복 후보는 다음 정보로 찾는다.

- 동일 `style_code`
- 동일 브랜드와 유사 상품명
- 동일 대표 이미지 SHA-256
- 동일 `style_group_id`

중복 후보는 자동 삭제하지 않고 `duplicates.json`에 기록한다.

### 10.2 이미지 중복

- SHA-256이 같으면 동일 파일로 판단한다.
- 해상도만 다른 같은 이미지 판정이 필요하면 perceptual hash를 보조 기준으로
  사용한다.
- perceptual hash가 같아도 원본 SHA-256과 출처 URL은 각각 보존한다.

### 10.3 상품 변경

이미 존재하는 상품을 다시 수집할 때:

- 가격·품절·이미지·사이즈표 변경을 비교한다.
- 기존 JSON을 덮어쓰기 전에 변경 이력을 남긴다.
- 이미지가 바뀌면 이전 파일과 새 파일을 모두 보존할 수 있다.
- `last_seen_at`을 갱신한다.
- 장기간 확인되지 않거나 삭제된 상품은 즉시 삭제하지 않고
  `DISCONTINUED` 후보로 표시한다.

## 11. 검증 상태

| 상태 | 의미 |
| --- | --- |
| `RAW` | 수집 직후, 검증 전 |
| `INVALID` | 필수 구조 또는 파일 검증 실패 |
| `REVIEW_REQUIRED` | 이상치 또는 판정 불확실 |
| `VALIDATED` | 자동 검증 통과 |
| `READY` | 수동 검수 포함 DB 적재 가능 |
| `REJECTED` | 품질·권리·내용 문제로 사용 제외 |

## 12. DB 적재 전 필수 검증

다음 조건을 모두 만족해야 `READY`로 전환한다.

- 출처와 상품 ID가 존재한다.
- 상품 URL 형식이 유효하다.
- 상품명, 브랜드, 성별, 슬롯과 카테고리가 존재한다.
- 대표 이미지가 실제로 열리고 최소 해상도를 충족한다.
- 대표 이미지 SHA-256이 기록되어 있다.
- `reference_type`, `model_present`, `other_garments_present`가 판정되어 있다.
- 한 개 이상의 사이즈 행이 존재한다.
- 슬롯별 필수 실측값이 존재한다.
- 모든 숫자 필드의 단위가 확인됐다.
- 이상치 경고가 해결됐거나 검수 사유가 기록됐다.
- `rights_status`가 기록되어 있다.

## 13. DB 매핑 기준

### 13.1 `products`

| 원본 JSON | DB 필드 |
| --- | --- |
| `product.name` | `name` |
| `product.brand` | `brand` |
| `product.price_krw` | `price` |
| `product.category` | `category` |
| `product.subcategory` | `subcategory` |
| 대표 이미지 저장 URL | `image_url` |
| `source.product_url` | `purchase_url` |
| `product.description` | `description` |
| `product.color_group` | `color_group` |
| `product.currency` | `currency` |
| 정규화 JSON SHA-256 | `source_hash` |

현재 DB에 추가를 권장하는 상품 필드:

- `source`
- `external_product_id`
- `gender`
- `slot`
- `reference_type`
- `image_sha256`
- `last_seen_at`
- `collection_status`

### 13.2 `product_top_sizes`

다음 값을 매핑한다.

- `size_name`
- `total_length`
- `shoulder_width`
- `chest_width`
- `sleeve_length`

추가 권장 필드:

- `hem_width`
- `measurement_basis`

### 13.3 `product_bottom_sizes`

다음 값을 매핑한다.

- `size_name`
- `total_length`
- `waist_width`
- `hip_width`
- `thigh_width`
- `rise`

추가 권장 필드:

- `inseam`
- `hem_width`
- `measurement_basis`

## 14. 수집 제외 기준

다음 상품은 수집하거나 DB에 적재하지 않는다.

- 공식 상품 URL이나 상품 ID를 확인할 수 없는 상품
- 대표 이미지 사용 상태를 확인할 수 없는 외부 재가공 이미지
- 실측표가 전혀 없는 상품
- 아동복, 속옷, 수영복 등 MVP 범위 밖의 카테고리
- 신발, 가방, 모자, 액세서리
- 여러 의상을 분리할 수 없는 세트 상품
- 이미지에서 의상 형태를 판별할 수 없는 상품
- 이미지 파일이 손상됐거나 지나치게 작은 상품
- 출처의 자동 수집 정책을 위반해야만 확보할 수 있는 상품
- 수집 과정에서 개인정보를 포함하게 되는 상품 데이터

## 15. 데이터 구성 목표

### 15.1 초기 파일럿 (완료 기준)

첫 수집 파일럿은 총 200개였다.

| 그룹 | 목표 수량 |
| --- | ---: |
| 여성 상의 | 50 |
| 여성 하의 | 50 |
| 남성 상의 | 50 |
| 남성 하의 | 50 |

### 15.2 확장 목표 (2026-08-01)

평가·추천 변별력을 위해 성별×상하의 셀당 **500개**, 총 **2000개**를 목표로 한다.

| 그룹 | 목표 수량 |
| --- | ---: |
| 여성 상의 (FEMALE/TOP) | 500 |
| 여성 하의 (FEMALE/BOTTOM) | 500 |
| 남성 상의 (MALE/TOP) | 500 |
| 남성 하의 (MALE/BOTTOM) | 500 |

run당 상품 수 상한은 두지 않는다. 배치 크기는 운영 편의에 따르며,
재개 시 `--skip-existing`으로 이미 정규화된 ID는 건너뛴다.

각 그룹은 다음 조건이 한쪽으로 몰리지 않게 구성한다.

- 슬림, 레귤러, 릴랙스, 오버핏
- 짧은 기장, 기본 기장, 긴 기장
- 무지, 로고, 그래픽, 반복 패턴
- 상품 단독컷과 착용컷
- 밝은색, 중간색, 어두운색
- 최소 2개 이상의 유효 사이즈 행을 가진 상품 우선

## 16. 운영 규칙

- 대량 수집 전 20개 상품으로 파서를 검증한다.
- 출처별 수집기는 독립 어댑터로 구현한다.
- **요청 간격 (v1.1):**
  - 상품 단위 최소 간격 **3.0초** — 다음 `product_id`의 첫 요청 전에 적용.
  - 같은 상품의 부가 API(actual-size, options 등)는 상품 간 간격을 다시
    기다리지 않아도 된다 (intra-product).
  - 이미지 요청 최소 간격 **1.0초**.
  - 동시 수집 워커 수 **1**. 동시 프로세스·IP 분산으로 처리량을 올리지 않는다.
  - 실측/상세에서 사이즈가 이미 확보되면 options 요청을 생략할 수 있다.
- 오류 시 무한 재시도하지 않는다. 재시도 상한 2회.
- HTTP **403 / 429 / 503** 또는 차단 페이지가 감지되면 해당 run을 **즉시 중단**한다.
  헤더 변조·프록시·우회 재시도 금지. 수 시간 이상 대기 후 팀 확인 하에 재개.
- HTTP 오류, 파싱 오류, 이미지 오류와 검증 오류를 분리해 기록한다.
- 수집 실패가 기존 정상 데이터를 삭제하지 않게 한다.
- 파서 변경 시 `collector_version`을 올린다.
- JSON 구조 변경 시 `schema_version`을 올린다.
- 실제 DB 적재는 수집 작업과 별도 명령으로 수행한다.
- 개발·평가 데이터와 운영 DB 데이터를 같은 디렉터리에 혼합하지 않는다.

## 17. 처리 흐름

```text
수집 허용 여부 확인
→ 상품 원본 메타데이터 확보
→ 원본 이미지 저장
→ 상품별 RAW JSON 저장
→ 형식·단위·이미지·해시 자동 검증
→ 중복과 이상치 검사
→ 수동 검수
→ 정규화 JSON 생성
→ READY 데이터만 DB 적재
→ 적재 결과와 원본 해시 기록
```

## 18. 변경 관리

이 규약을 변경할 때는 문서 버전과 변경일을 갱신한다.

- 패치 버전: 문구·예시 수정
- 마이너 버전: 선택 필드 또는 검증 규칙 추가
- 메이저 버전: 식별자, 필수 필드, 단위 또는 JSON 구조 변경

수집 데이터에는 항상 적용된 `schema_version`을 기록한다. 서로 다른 메이저 버전의
JSON을 같은 importer로 암묵적으로 처리하지 않는다.

### 변경 이력

| 버전 | 일자 | 요약 |
| --- | --- | --- |
| 1.0.0 | 2026-07-29 | 초안. 파일럿 200, 수집 기준 정의 |
| 1.1.0 | 2026-08-01 | 확장 목표 셀당 500(총 2000). run 상한 제거. 상품 간 3.0초 / 동일 상품 부가 API 비대기, options 조건부 생략 명시 |

