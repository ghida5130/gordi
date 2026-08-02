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
