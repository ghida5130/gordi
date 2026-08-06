# TPO 데이터셋 확장 수집 종료 보고

- 작성일: 2026-08-05
- 작성: Grok Build (수집 실행·감시·후처리)
- 근거 핸드오버: [GROK_HANDOVER_TPO_EXPANSION_2026-08-04.md](GROK_HANDOVER_TPO_EXPANSION_2026-08-04.md)
- 수집 정책: [garment-data-collection-policy-v1.md](garment-data-collection-policy-v1.md) **v1.1.0** (상품 간 3.0s, 단일 워커, 403/429/503 즉시 중단)
- 데이터셋 루트: `ai/garment_dataset-v2/` (**Git 미커밋**)

---

## 1. 한 줄 결론

**TPO 확장 수집을 여기서 종료한다.**  
정규화 **17,604**건, 그중 **READY 12,726**건으로 핸드오버 목표(READY 약 10,000+)를 초과 달성했다.  
추가 raw 수집보다 **실측 검증 규칙·서브카테고리 매핑**이 READY 분포를 더 좌우하는 구간까지 왔다.

---

## 2. 시작 vs 종료

| 지표 | TPO 착수 직전 (대략) | 종료 시점 (2026-08-05) |
|---|---:|---:|
| normalized | ~2,943 → day1 전후 확장 | **17,604** |
| READY | ~2,010 (리뷰 후) → day1 전 약 4.6k 경로 | **12,726** |
| REVIEW_REQUIRED | — | **306** |
| INVALID | ~880대에서 증가 | **4,572** |
| MALE/TOP (전체) | ~750 | **5,881** |
| MALE/BOTTOM | ~750 | **3,120** |
| FEMALE/TOP | ~720 | **5,535** |
| FEMALE/BOTTOM | ~702 | **2,988** |

> 셀 수는 `gender × backend_category` 기준. OUTER 슬롯 상품 다수는 backend_category **TOP**으로 저장된다.

### slot 분포 (전체 normalized)

| slot | 개수 |
|---|---:|
| TOP | 7,738 |
| BOTTOM | 6,128 |
| OUTER | 3,738 |

---

## 3. 세션별 실행 요약

공통 파이프라인 (매 세션):

1. PLP discover (`scripts/discover_plp_ids.py --plan …`, oversample **1.45**, page delay 1.5s)  
2. 분리 수집 (`start_collect_detached.ps1` / 작업 스케줄러, `--skip-existing`, product delay 3.0s)  
3. 감시·재기동·후처리 (`watch_collect_and_postprocess.ps1`)  
   - validate → review-images (`reasoning-effort low`) → summarize  
4. 모니터 종료 코드: validate에 INVALID가 있으면 exit 1 → 로그상 `failed=True`로 찍힘 (**수집 실패와 무관**)

| 세션 | 기간 (대략) | 배치 ID | 수집 결과 | normalized 누적 |
|---|---|---:|---|---:|
| **Day1 아우터** | 08-04 21:55 → 08-05 00:54 | 3,615 | 성공 (일부 초반 재기동) | ~6,558 |
| **Day2 포멀·니트·스커트/원피스** | 08-05 09:04 → 12:25 | 3,817 | 1차 **503 stop** 후 자동 재개, 잔여 완료 | ~10,375 |
| **Day3 데일리·스포티** | 08-05 13:01 → 20:09 | 6,008 | 네트워크 일시 중단 후 재개, EXIT=0 | ~16,383 |
| **Day4 부족 셀** | 08-05 20:41 → 21:44 | 1,221 | **1221/1221** EXIT=0 | **17,604** |

배치 파일 합계(고유 ID 나열): 3,615 + 3,817 + 6,008 + 1,221 = **14,661**  
(기존 보유분 skip·세션 간 중복 제외로 normalized 순증은 이와 다름.)

### Day별 배치 경로

| 세션 | plan / all ids |
|---|---|
| Day1 | `ai/batches/tpo_session1_outer_plan.json`, `tpo_day1_outer_all.txt` |
| Day2 | `tpo_session2_formal_plan.json`, `tpo_day2_formal_all.txt` |
| Day3 | `tpo_session3_daily_plan.json`, `tpo_day3_daily_all.txt` |
| Day4 | `tpo_session4_shortfall_plan.json`, `tpo_day4_shortfall_all.txt` |

운영 로그: `ai/garment_dataset-v2/reports/overnight/`  
(`collect-*.log`, `watch-postprocess-*.log`, `session-*-postprocess-summary-*.txt`)

---

## 4. READY 서브카테고리 스냅샷 (종료 시점)

`gender/backend_subcategory` READY 상위 및 주요 TPO 축:

| backend_sub | MALE | FEMALE |
|---|---:|---:|
| SHIRT | 1,031 | 687 |
| JACKET (아우터 다수 포함) | 938 | 590 |
| SHORT_SLEEVE | 531 | 435 |
| KNIT | 513 | 398 |
| HOODIE | 395 | 214 |
| DENIM_PANTS | 379 | 327 |
| SLACKS | 352 | 358 |
| LONG_SLEEVE | 302 | 304 |
| JOGGER_PANTS | 293 | 252 |
| SPORTS_TOP | 305 | 111 |
| SPORTS_BOTTOM | 382 | 244 |
| COAT | 201 | 245 |
| PADDING | 200 | 150 |
| CARDIGAN | 188 | 224 |
| SKIRT | — | 436 |
| DRESS | 3 | **300** |
| SHORTS | 106 | 105 |
| COTTON_PANTS | **88** | **52** |
| SLEEVELESS | 90 | 139 |
| OTHER_BOTTOM | 326 | 469 |

### 핸드오버 목표 대비 (요약)

- **달성·근접:** 아우터(재킷·코트·패딩·카디건 축), 셔츠·니트·슬랙스, 반/긴소매·후드·맨투맨, 데님·조거, 스커트, 원피스(READY 300), 스포츠 하의 등 다수.  
- **라벨상 부족이 남은 축:**  
  - `COTTON_PANTS` (남 88 / 여 52)  
  - `SHORTS` (남 106 / 여 105)  
  - `FEMALE/SPORTS_TOP` (111, 목표 150)  
  - 민소매 소폭 short  

**원인 (Day4 분석):**  
PLP `003006`(코튼 의도)·쇼츠 카테고리 상품이 파서에서 **`OTHER_BOTTOM` / `SPORTS_BOTTOM`** 등으로 분류되어, 같은 상품이 READY여도 `COTTON_PANTS`/`SHORTS` 카운터에는 안 잡힘.  
→ **재수집만으로는 해당 라벨 gap이 줄지 않음.** 매핑 수정 또는 목표 키 재정의가 필요.

---

## 5. INVALID (규칙 유지 결정 유지)

- 종료 시점 INVALID **4,572** (~26% of normalized).  
- 주원인: 실측 필수 필드 미충족  
  - TOP/OUTER: 특히 **`shoulder_width`** (무신사 표에 총장·가슴·소매는 흔하고 어깨는 드묾)  
  - BOTTOM: **`hip_width`** 등  
  - `sizes empty` 일부  
- 팀 결정: **검증 규칙 유지** 상태로 수집 종료.  
- INVALID 비율을 줄이려면 후속으로 규칙 완화 또는 필드 매핑 개선이 필요 (수집 배치 추가보다 ROI 큼).

---

## 6. 운영 이슈·교훈

1. **에이전트 job 안 python**은 모니터/세션 종료 시 같이 죽을 수 있음 → **작업 스케줄러 분리 수집**으로 해결.  
2. **403/429/503** 시 정책대로 전체 stop → watcher가 `--skip-existing`으로 재개 (Day2 503 사례).  
3. 후처리 모니터 `failed=True`는 대부분 **validate exit 1 (INVALID 존재)** 또는 review 1건 실패. 수집 EXIT=0과 별개.  
4. review-images는 멱등; 빈 VLM 응답 1건 등은 재실행으로 회복 가능.  
5. 요청 간격·동시성·우회 없음 준수.

---

## 7. 범위 밖 (핸드오버 §4 — 미실행)

다음 단계는 **수집 종료 후 다른 담당/세션** 권장:

1. (선택) `review-images` 잔여/실패 1건 재실행  
2. selection 파일 작성 (READY 균형 샘플)  
3. `export-seed` + expected-counts / size-rows  
4. S3 업로드 → EC2/DB seed  
5. 임베딩 재구축 (기존 해시 재사용, 신규분만)  
6. `candidate_limit` 상향 및 재평가  

**본 보고 시점에서 raw 추가 수집은 하지 않는다.**

---

## 8. 산출물 체크리스트

| 구분 | 경로 | 비고 |
|---|---|---|
| 데이터 | `ai/garment_dataset-v2/` | raw / images / normalized / reports — **Git 제외** |
| 배치·플랜 | `ai/batches/tpo_*` | plan JSON + id txt + discover-report |
| 스크립트 | `ai/scripts/discover_plp_ids.py`, `start_collect_detached.ps1`, `watch_collect_and_postprocess.ps1`, `summarize_dataset_cells.py` | 재현용 |
| 야간 로그 | `ai/garment_dataset-v2/reports/overnight/` | collect/watch/session summary |
| 정책·핸드오버 | `docs/ai/garment-data-collection-policy-v1.md`, `docs/ai/GROK_HANDOVER_TPO_EXPANSION_2026-08-04.md` | 변경 없음 (수집 종료 결정만 본 문서) |

---

## 9. 권고 후속 (우선순위)

| 순위 | 작업 | 이유 |
|---|---|---|
| 1 | selection + export-seed + seed/embed | READY 1.2만으로 평가 파이프라인 진행 가능 |
| 2 | `backend_subcategory` 매핑 점검 (기타 하의→코튼, 쇼츠 표기) | 라벨 gap 해소, 재수집 불필요 가능 |
| 3 | (선택) 실측 필수 필드 정책 재검토 | INVALID 4.5k 중 상당수 회수 |
| 4 | 추가 PLP 수집 | 지금은 한계효용 낮음 |

---

## 10. 서명

- 수집 실행·감시·세션 후처리: Grok Build  
- 종료 결정: 사용자 지시 (부족 셀 Day4 이후 **수집 종료 보고**)  
- 종료 시각 기준 스냅샷: 2026-08-05 day4 후처리 완료 시점 (`normalized=17604`, `READY=12726`)
