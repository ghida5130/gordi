# 2026-08-01 AI 추천 파이프라인 하루 회고

브랜치: `ai/feat/garment-recommendation`
범위: dev 병합 정리 → 추천 품질 개선 P0-A 전체 → 데모 개선 → 성능 최적화 → VLM 모델 벤치마크

## 오늘 한 일 요약

어제까지의 baseline(멀티모달 유사도 65% + 키워드 규칙 35%)에 VLM 기반
품질 개선 3종을 얹고, 개선 여부를 잴 수 있는 평가 하네스를 먼저 고정한 뒤,
데모에서 체감되는 latency를 35초 → 9.5초로 줄였다. 커밋 13개.

| 커밋 | 내용 |
|---|---|
| `741d84d` | origin/dev 병합 (방 실시간 협업 WebSocket, LiveKit, DataInitializer 등 21커밋) |
| `9cfe254` | DataInitializer가 gender 없이 Recommendation을 생성해 기동이 깨지는 의미 충돌 수정 |
| `9050dd5` `f92cf5c` | 밀려 있던 Compose 인덱스 mount·데모 설정과 운영 문서 커밋 |
| `052e09c` | 평가 하네스 + baseline 고정 (recall@K, nDCG@K, pairwise, 다양성, latency / 오프라인·라이브 2모드) |
| `f12619c` | 이미지 속성 추출: query 이미지 → 색상/계절/스타일/패턴 closed vocabulary → 텍스트와 동일 intent schema 병합 |
| `c9c85b1` | VLM pairwise 코디 궁합 reranker (상위 N만, 실패 시 규칙 fallback) |
| `57f1f8b` | 근거 기반 LLM 추천 이유 (fact sheet 전달, 환각 라벨 검출 시 규칙 fallback) |
| `0407f47` | README에 VLM 기능·평가 워크플로 문서화 |
| `d2a8937` | 데모 프론트 페이지 전면 재작성 (반응형, 다크/라이트, 점수 바, 상태 분리) |
| `e64cafd` | 파이프라인 진행 이벤트 NDJSON 스트리밍 + 데모 실시간 타임라인 |
| `527c31f` | VLM 판정 병렬화 + 판정 출력 축소 (35s → 8.9s) |
| `0de4791` | 6개 비전 모델 벤치마크 + reasoning effort 설정화 |

## 설계 결정

1. **평가 먼저, 튜닝 나중.** 핸드오프 원칙대로 heuristic seed 평가셋
   10 query와 규칙 기반 baseline(recall@10 0.377, nDCG@10 0.622)을 먼저
   고정했다. heuristic 라벨은 규칙 기반에 유리한 편향이 있어 절대 품질이
   아닌 회귀 감지·모델 간 상대 비교 용도이며, 사람 라벨로 교체가 전제다.
2. **VLM 기능은 전부 opt-in + graceful degradation.** 이미지 속성 추출,
   pairwise reranker, LLM 이유 모두 기본 false이고, VLM 호출이 실패해도
   규칙 기반으로 강등될 뿐 추천이 죽지 않는다.
3. **VLM 클라이언트는 OpenAI 호환 1개로 통일.** OpenRouter 상용 모델과
   로컬 Ollama/vLLM을 endpoint 교체만으로 오갈 수 있다.
4. **VLM 출력은 신뢰하지 않는다.** 속성 추출은 closed vocabulary 밖 값을
   폐기하고, 추천 이유는 fact sheet에 없는 태그 라벨이 나오면 환각으로
   간주해 규칙 기반으로 대체한다.

## 트러블슈팅 기록

### 1. dev 병합 후 백엔드 기동 불가 (의미 충돌)

텍스트 충돌 없이 auto-merge됐지만, dev의 신규 `DataInitializer`가
gender 없이 `Recommendation`을 생성하는데 우리 브랜치에서 `gender`를
non-null로 만들어 빈 DB 기동 시 제약 위반으로 seed가 터졌다.
**교훈: merge가 깨끗해도 우리 쪽 스키마 강화와 상대 쪽 신규 코드의
조합은 컴파일·기동 검증이 필요하다.**

### 2. pytest가 임시 디렉터리 권한 오류로 전멸

`C:\...\Temp\pytest-of-SSAFY` 접근 거부(WinError 5)로 tmp_path 사용
테스트가 모두 ERROR. 실행 환경 sandbox 제약이 원인. `--basetemp`를
허용된 경로로 지정해 해결. 코드 문제가 아니므로 실패 로그를 그대로
믿지 말 것.

### 3. 백엔드 `contextLoads` 1건 실패

로컬 MySQL 미기동 상태에서 DB 연결 실패. 105개 중 104개 통과,
코드 문제 아님. DB 필요 테스트와 순수 단위 테스트의 분리가 없다는
점은 개선 여지.

### 4. 데모 페이지 hidden 상태 겹침

`.state { display: flex }`가 `[hidden]` 속성의 UA 스타일(display:none)을
덮어써 로딩/빈/idle 상태가 동시에 렌더링됐다.
`[hidden] { display: none !important; }` 전역 가드로 해결.
**교훈: hidden 속성은 display를 지정한 요소에서 조용히 무력화된다.**

### 5. VLM 판정이 조용히 잘림 — reasoning 토큰 (최대 삽질)

병렬화와 함께 판정 `max_tokens`를 64로 조인 뒤, 벤치마크에서 luna
118/200, gpt-5-nano 200/200 판정 실패가 나왔다. 지표가 규칙 baseline과
정확히 일치해 전량 fallback임을 눈치챘고, 단건 probe로 원인 확인:
OpenAI reasoning 계열은 **숨은 reasoning 토큰이 max_tokens를 함께
소진**해 `finish_reason: length` + 빈 content가 된다. 단순 프롬프트에선
통과해 초기 테스트에서 안 잡혔다.
수정: 판정 상한 256 + `reasoning: {effort: low}` → luna 실패 0.
**교훈: (1) fallback이 있는 시스템은 실패가 지표 열화로만 나타나므로
실패 카운트를 반드시 별도 노출할 것(eval 리포트에 judged/failed 추가).
(2) 토큰 절약 최적화는 reasoning 모델에서 역효과가 날 수 있다.**

### 6. Gemma가 reasoning 필드 자체를 거부

effort low를 하드코딩하자 이번엔 gemma-4가 197/200 실패.
OpenRouter가 `reasoning` 파라미터를 모든 모델에서 무시해주지 않는다.
`RECOMMENDATION_VLM_REASONING_EFFORT` 설정으로 분리(빈 값 = 미전송)하고
모델과 세트로 관리하도록 문서화.
**교훈: "통합 게이트웨이가 알아서 정규화해준다"는 가정은 모델별로
검증해야 한다.**

### 7. 후보 이미지 fetch 실패 (미해결, 의도된 fallback)

DB `image_url`이 `http://gordi-nginx/...` placeholder라 nginx 미기동
로컬에선 후보 이미지를 못 가져와 VLM 판정이 metadata 전용으로 강등된다.
동작에는 지장 없지만 판정 근거가 얇아진다. reranker가 데모 dataset
경로를 쓰도록 하는 개선이 후속 과제.

## 성능 개선 여정

| 단계 | 조건 | latency |
|---|---|---|
| 순차 판정 | K=5, rationale 포함 | 35.1s |
| 병렬 8 + score 전용 | K=5 | 8.9s |
| 병렬 8 | K=20 (3웨이브) | 21.4s |
| **병렬 20** | **K=20 (1웨이브)** | **9.5s** |

판정 수를 4배로 늘리고도 순차 대비 3.7배 빨라졌다. 남은 시간의
대부분은 "가장 느린 판정 1건 + 쿼리 임베딩 1회"라 추가 단축은 모델
교체(gemma ~15%↓) 또는 listwise 구조 변경 영역이다.

## 모델 벤치마크 결론 (상세: `ai/eval/benchmarks/2026-08-01-rerank-model-comparison.md`)

- **기본값 유지: gpt-5.6-luna + effort low** (nDCG 0.634, 6.5s, 실패 0)
- **대안: gemma-4-26b-a4b + effort 빈 값** (nDCG 0.641, 5.5s, 30% 저렴) —
  품질 차는 오차 범위, 전환 시 effort 설정 주의
- 탈락: nano(판정 실패 다수), qwen(내부 reasoning으로 28.7s),
  seed(16.3s), nova-lite(2.4s지만 품질 baseline 이하)

## 현재 상태와 남은 일

- 테스트: AI 110개 전부 통과, 백엔드 104/105(1건은 DB 미기동 환경 문제)
- 데모: `gordi-ai-demo` 컨테이너, luna / K=20 / 병렬 20, 9.5s
- 원격 push는 아직 안 함 (dev merge 포함 로컬 13커밋 대기)

다음 우선순위:
1. **사람 라벨 평가셋** — heuristic 라벨로는 코디 궁합 품질을 판단할 수
   없다. luna vs gemma 재판정도 이것에 달려 있다.
2. 후보 이미지를 판정에 포함 (dataset 경로 or S3 업로드 후 실URL)
3. P0-B: Spring `/search` 연결 계약 확정
4. P0-C: 운영 S3 업로드·DB seed (runbook 절차)
