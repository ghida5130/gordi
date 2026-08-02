# VLM pairwise reranker 모델 비교 (2026-08-01)

## 방법

- 데이터셋: `eval/queries-seed-v1.jsonl` (10 query, heuristic 라벨)
- 오프라인 leave-one-out retrieval → **top 20 후보 전부 VLM pairwise 판정**
  (동시성 8), 후보 이미지는 미첨부(metadata 전용)라 모델 간 조건 동일
- 판정 설정: `max_tokens=256`, reasoning effort는 모델별 적정값
  (OpenAI 계열 `low`, Gemma/Seed는 미전송)
- latency는 query당 전체 파이프라인 시간(판정 20건 병렬 포함, 임베딩 제외)
- 원본 리포트: `2026-08-01-rerank-models/`(1차), `2026-08-01-rerank-models-v2/`(최종)

## 최종 결과 (v2)

| 모델 | nDCG@10 | recall@10 | pairwise | latency mean/p95 | 판정 실패 | 가격(프롬프트/출력, $/M) |
|---|---|---|---|---|---|---|
| **google/gemma-4-26b-a4b-it** (effort 없음) | **0.641** | 0.360 | 1.000 | **5.5s / 7.6s** | 0/200 | 0.07 / 0.34 |
| **openai/gpt-5.6-luna** (effort low) | 0.634 | 0.339 | 1.000 | 6.5s / 9.5s | 0/200 | 0.10 / 0.60 |
| qwen/qwen3.7-flash (effort low) | 0.626 | 0.330 | 1.000 | 28.7s / 39.6s | 2/200 | 0.03 / 0.13 |
| bytedance-seed/seed-1.6-flash (effort 없음) | 0.591 | 0.396 | 1.000 | 16.3s / 36.8s | 1/200 | 0.075 / 0.30 |
| openai/gpt-5-nano (effort low) | 0.523* | 0.305* | 1.000 | 19.7s | **131/200** | 0.05 / 0.40 |
| amazon/nova-lite-v1 | 0.499 | 0.236 | 0.900 | **2.4s / 6.2s** | 0/200 | 0.06 / 0.24 |

규칙 기반 baseline(재정렬 없음): nDCG@10 0.622, recall@10 0.377, ~9ms.
\* nano는 실패 시 규칙 점수 fallback이 섞인 수치라 모델 자체 품질이 아님.

## 벤치마크 중 확인된 운영상 주의점

1. **OpenAI reasoning 계열은 `reasoning: {effort: low}`가 필수.**
   숨은 reasoning 토큰이 `max_tokens`를 소진해 응답이 잘린다. 1차 실행에서
   luna 118/200, nano 200/200 실패의 원인. effort low 적용 후 luna는 실패 0.
2. **Gemma는 `reasoning` 필드를 받으면 요청이 거부된다** (197/200 실패).
   OpenRouter가 모든 모델에서 이 필드를 무시해주지 않으므로
   `RECOMMENDATION_VLM_REASONING_EFFORT`는 모델과 세트로 관리해야 한다.
   Gemma/Seed 계열로 바꿀 때는 빈 값으로 둘 것.
3. gpt-5-nano는 effort low로도 판정 실패가 많아 reranker 용도로 부적합.
4. qwen3.7-flash는 응답은 정확하지만 내부 reasoning이 커서(~1k 토큰/판정)
   가장 느리다. 가격 대비로도 이득이 없다.

## 한계

- heuristic 라벨(같은 세부분류+색상 일치) 기준이라 절대 품질이 아니라
  **모델 간 상대 비교와 안정성 확인** 용도다. run-to-run 편차도 있어
  (gemma 1차 0.690 → 최종 0.641) gemma vs luna의 품질 차이는 오차 범위.
- latency는 OpenRouter provider 큐 상태에 따라 변동한다.

## 결론

- **기본값 유지: `openai/gpt-5.6-luna` + `effort=low`** — 실패 0, 6.5s,
  이미지 입력 품질이 검증된 안전한 선택.
- **비용/속도 대안: `google/gemma-4-26b-a4b-it` + effort 빈 값** — 동급
  품질에 ~15% 빠르고 프롬프트 기준 30% 저렴. 전환 시 반드시
  `RECOMMENDATION_VLM_REASONING_EFFORT=`(빈 값) 설정.
- 사람 라벨 평가셋이 생기면 luna vs gemma를 재판정할 것.
