# 추천 파이프라인 평가 하네스

추천 품질 변경 전후를 같은 잣대로 비교하기 위한 평가셋과 지표 러너다.
핸드오프 원칙에 따라, 점수 가중치나 모델을 바꾸기 전에 반드시 baseline
수치를 먼저 고정하고 변경 후 같은 데이터셋으로 재측정한다.

## 실행

```bash
# 스냅샷에서 heuristic seed 평가셋 생성 (결정적)
python -m app.recommendation.eval_cli generate-seed --output eval/queries-seed-v1.jsonl

# 오프라인 평가 (API 호출 없음, CI 가능)
python -m app.recommendation.eval_cli run --dataset eval/queries-seed-v1.jsonl --mode offline --output eval/baselines/<date>-offline.json

# 라이브 평가 (OPENROUTER_API_KEY 필요, 쿼리 텍스트를 실제 임베딩)
python -m app.recommendation.eval_cli run --dataset eval/queries-seed-v1.jsonl --mode live
```

## 모드

- `offline`: 각 query의 anchor 상품 임베딩을 스냅샷에서 꺼내 query로
  사용하는 leave-one-out 방식. anchor 자신은 결과에서 제외된다.
  결정적이고 무료라서 회귀 감지용 기준선으로 쓴다.
- `live`: query 텍스트를 OpenRouter로 실제 임베딩. 운영 경로와 동일하며
  비용과 네트워크가 든다.

## 데이터셋 스키마 (`recommendation-eval-v1`, JSONL)

```json
{
  "schema_version": "recommendation-eval-v1",
  "query_id": "seed-male-short_sleeve-1234567",
  "text": "블랙 여름 반팔티",
  "query_product_key": "MUSINSA:1234567",
  "filters": {"gender": "MALE", "category": "TOP", "subcategory": null, "budget_min": 0, "budget_max": null},
  "relevant": {"MUSINSA:2345678": 2, "MUSINSA:3456789": 1},
  "pairs": [["MUSINSA:2345678", "MUSINSA:3456789"]],
  "label_source": "heuristic"
}
```

- `relevant`: product key(`SOURCE:EXTERNAL_ID`) → 등급(1 이상, 클수록 적합).
- `pairs`: `[better, worse]` 쌍. 최종 랭킹이 이 순서를 지키는지 측정.
- `label_source`: `heuristic`(메타데이터 유도) 또는 `human`(사람 검수).

## 지표

- recall@K, nDCG@K (K=5,10)
- pairwise accuracy (+ 평가/스킵 쌍 수)
- brand diversity@10 (상위 10개 중 고유 브랜드 비율)
- latency mean / p95

## seed 라벨의 한계 — 사람 라벨로 교체 필요

`queries-seed-v1.jsonl`의 라벨은 "같은 세부 카테고리 = 관련(1),
색상까지 일치 = 선호(2)"라는 메타데이터 규칙으로 만들었다. 현재
규칙 기반 compatibility 점수와 같은 신호를 쓰므로 **pairwise
accuracy가 규칙 기반 시스템에 유리하게 나온다.** 코디 궁합 품질을
판단하려면 `label_source: human` 데이터가 필요하다.

사람 라벨 작성 방법: 같은 스키마로 JSONL 한 줄씩 추가하되
`label_source`를 `human`으로 두고, 실제 코디 관점에서 relevant 등급과
pairs를 판단한다. anchor 없이 텍스트 전용 query도 가능하다(그 경우
live 모드로만 평가).

## TPO 적합 평가 (사람 라벨, `queries-tpo-v1.jsonl`)

TPO 자유 텍스트("결혼식 하객", "면접" 등)에 대해 **retrieval 모집단이
실제로 그 상황에 맞는 상품을 담는지**를 재는 사람 라벨 평가다.
heuristic 라벨로는 TPO 적합성을 판단할 수 없으므로 정답 라벨 없이
출발하고, 팀원의 판정이 곧 라벨이 된다. nDCG 같은 리랭크 지표는
모집단 내 상대 순위만 측정하므로 이 지표 없이는 "모집단 전체가
TPO와 어긋나는" 실패를 볼 수 없다.

- 쿼리셋: `queries-tpo-v1.jsonl` (`recommendation-tpo-eval-v1`,
  24개 — 포멀/데일리/파티·데이트/운동/여행/계절, 남녀·상하의 균형)
- 평가 진행: `ENABLE_RECOMMENDATION_DEMO=true`로 AI 서버 실행 후
  `http://localhost:8000/demo/tpo-eval` 에서 평가자 이름 입력 →
  쿼리 선택 → 추천 실행 → 결과별 적합/부적합/모름 판정 → 저장.
- 판정 저장: `eval/judgments/tpo-v1.jsonl` (append-only,
  `recommendation-tpo-judgment-v1`). 같은 (평가자, 쿼리, 상품)을
  다시 판정하면 집계 시 마지막 기록이 이긴다. 판정 파일은 사람
  라벨 원본이므로 **Git에 커밋한다.**
- 집계: 데모의 "집계 보기" 또는 `GET /api/v1/demo/tpo-eval/summary`.
  - `fit_rate = FIT / (FIT + UNFIT)` — UNSURE는 분모에서 제외
  - `macro_fit_rate`: (쿼리, 평가자) 단위 적합률의 평균 —
    특정 쿼리를 많이 판정해도 전체를 지배하지 못한다
  - `micro_fit_rate`: 전체 판정 기준 적합률
- 판정 기록에는 `index_version`(snapshot SHA-256)이 남으므로
  카탈로그 확장 전후 수치를 같은 파일에서 분리 집계할 수 있다.

### TPO Baseline (2026-08-05, 확장 전 카탈로그 1,991건)

`eval/baselines/2026-08-05-tpo-human-baseline.json`
(snapshot `3d282547…`, 평가자 6명 × 24쿼리 × 10건 = 판정 1,440건 전량 완료)

| 지표 | 값 |
|---|---|
| macro fit rate | **0.772** |
| micro fit rate | 0.776 |
| FIT / UNFIT / UNSURE | 1,065 / 308 / 67 |

쿼리 유형별 패턴이 진단과 정확히 일치한다: 운동·발표·여행
쿼리는 0.96~0.98로 높지만, **포멀·격식 계열이 최하위**다 —
첫 출근(0.49), 겨울 데이트(0.50), 남성 면접(0.54), 여성 하객
하의(0.55), 여성 면접(0.59). 캐주얼 재고는 충분하지만 포멀
재고와 TPO 신호가 부족하다는 뜻이며, TPO 균형 확장 + VLM TPO
태깅 + 재임베딩 후 같은 쿼리셋으로 재평가해 이 수치와 비교한다.

### 2k vs 15k 비교 결과 (2026-08-06)

`eval/baselines/2026-08-06-tpo-2k-vs-15k-comparison.json`
(15k 라운드: snapshot `c7ab35b8…`, 평가자 7명 × 24쿼리 = 1,680건)

| | 2k baseline | 15k + TPO 태그 | Δ |
|---|---:|---:|---:|
| macro fit rate | 0.772 | **0.927** | **+0.155** |
| micro fit rate | 0.776 | 0.927 | +0.151 |
| UNFIT | 308 | 121 | −61% |

포멀 클러스터가 목표대로 회복됐다: 첫 출근 0.49→**0.97**,
남성 면접 0.54→**0.99**, 겨울 데이트 0.50→0.93, 여성 하객 하의
0.55→0.87, 여성 면접 0.59→0.87, 명절 0.63→0.87. 24개 쿼리 중
20개 개선, 하락 4개는 최대 −0.05로 잡음 수준. 개선 요인은
TPO 균형 재고 확충(2k→15k, INVALID 회수 포함) + 임베딩 문서의
한국어 TPO 태그·캡션 + TPO 텍스트의 질의·리랭크 반영이 결합된
것으로, 요인 분리는 하지 않았다(팀 합의 범위).

## VLM 리랭크 on/off A/B 평가 (`queries-vlm-ab-v1.jsonl`)

VLM opt-in(pairwise 리랭크)이 추천 품질을 실제로 올리는지 재는
블라인드 선호 평가. TPO 쿼리셋에서 6개를 추려 빠른 라운드
(인당 ~10분)로 돌린다.

- 진행: 데모 서버 실행 후 `http://localhost:8000/demo/vlm-ab` —
  쿼리 선택 → 같은 쿼리를 리랭크 ON/OFF 두 파이프라인으로 동시
  실행(좌우 배치 무작위, 어느 쪽이 VLM인지 비공개) → 더 나은 쪽
  투표(A/B/비슷함) → 저장.
- ON 팔은 로컬 env 플래그와 무관하게 리랭커를 강제 주입한다 —
  VLM 런타임이 없으면 503 으로 명시 실패(조용한 강등 금지).
- 판정 저장: `eval/judgments/vlm-ab-v1.jsonl` (append-only,
  재투표는 마지막 것이 이김, **Git 커밋 대상**). 실행별 지연
  (ON/OFF ms)도 함께 기록되어 품질-비용 트레이드오프를 같은
  데이터로 말할 수 있다.
- 집계: 페이지 "집계 보기" 또는 `GET /api/v1/demo/vlm-ab/summary`
  — ON 승률(무승부 제외), 쿼리별 승패, 평균 지연 ON/OFF.

## Baseline (2026-08-01, 규칙 기반 0.65/0.35)

`eval/baselines/2026-08-01-offline-rule-baseline.json`

| 지표 | 값 |
|---|---|
| query 수 | 10 |
| recall@5 | 0.240 |
| recall@10 | 0.377 |
| nDCG@5 | 0.591 |
| nDCG@10 | 0.622 |
| pairwise accuracy | 1.000 (heuristic 라벨 편향 주의) |
| brand diversity@10 | 0.79 |
| latency mean | 8.7ms (오프라인, 임베딩 API 제외) |

인덱스: `google/gemini-embedding-2`, 768차원, 198상품,
snapshot `7fc0e03b…`.
