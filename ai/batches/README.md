# 수집 배치 ID 목록

확장 목표: 셀당 **500** (MALE/FEMALE × TOP/BOTTOM, 총 2000).

## 현재 목록 (PLP discover, 2026-08-01)

무신사 공개 PLP API (`api2/dp/v1/plp/goods`)로 확보.  
이미 `garment_dataset-v2/normalized` 에 있는 ID는 제외.  
실패·제외 버퍼로 gap × **1.6** oversample.

| 파일 | 셀 | 신규 ID | 당시 have → 목표 |
|---|---|---:|---|
| `male_top.txt` | MALE/TOP | 624 | 110 → 500 |
| `male_bottom.txt` | MALE/BOTTOM | 546 | 159 → 500 |
| `female_top.txt` | FEMALE/TOP | 671 | 81 → 500 |
| `female_bottom.txt` | FEMALE/BOTTOM | 637 | 102 → 500 |
| `overnight_all.txt` | 합본 | **2478** unique | — |
| `discover-report.json` | 메타 | — | 소스/페이지 통계 |

재생성:

```powershell
cd ai
.\.venv\Scripts\python scripts\discover_plp_ids.py `
  --dataset-root garment_dataset-v2 `
  --out-dir batches `
  --target-per-cell 500 `
  --oversample 1.6 `
  --page-delay 1.5
```

## 형식

```text
# 주석
5313017
5987009  # trailing comment ok
```

- 한 줄에 상품 ID 하나 (무신사 `products/{id}`)
- 빈 줄·`#` 줄 무시
- 수집기가 순서 보존 de-dupe

## 밤새 수집

```powershell
cd ai
# dry-run
.\.venv\Scripts\python -m garment_collector collect `
  --ids-file batches/overnight_all.txt `
  --dataset-root garment_dataset-v2 `
  --skip-existing --dry-run

# 본 수집 (절전 해제, 프로세스 1개만)
.\scripts\collect_overnight.ps1 -IdsFile batches\overnight_all.txt
```

예상: 신규 ~2500 × 약 12–16초 ≈ **8–11시간** (스킵·실패에 따라 변동).  
403/429/503 시 즉시 재시도 금지.
