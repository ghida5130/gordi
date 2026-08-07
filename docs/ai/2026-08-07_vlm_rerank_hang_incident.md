# 버그 판정 — VLM 리랭크 판정 1건이 212초 매달린 건 (2026-08-07)

- 발견: 2026-08-06 팀원 배포판 테스트 중
- 판정: **버그 맞음 (P2)** — 품질 방어선은 동작했으나, 지연 상한이 사실상 없음
- 관련 코드: `ai/app/recommendation/vlm.py`, `ai/app/services/vector_ranker.py`,
  `ai/app/recommendation/pipeline.py`

## 증상 (배포판 로그)

```
WARNING app.services.vector_ranker: pairwise rerank failed for product 8553; keeping rule-based score
...
json.decoder.JSONDecodeError: Expecting value: line 267 column 1 (char 1463)
...
app.recommendation.vlm.VLMError: VLM returned a non-JSON response
INFO app.services.vector_ranker: pairwise rerank (/rank): top_k=12 workers=12 failed=1 elapsed=212.74s
```

## 사실 확인

| 항목 | 확인 결과 |
|---|---|
| 추천 결과 | 정상 반환 — 실패한 판정 1건만 규칙 점수로 강등 (`failed=1`), 폴백 설계 의도대로 동작 |
| 응답 본문 | `line 267 column 1 (char 1463)` → **266줄 / 1,463자** (줄당 평균 ~5.5자). 정상 JSON 응답이 아니라, 게이트웨이가 업스트림 응답을 기다리는 동안 보내는 연결 유지용 filler(공백·주석 줄)만 오다가 JSON 없이 종료된 형태 |
| 소요 시간 | 판정 1건이 ~212초 점유. `VLMSettings.timeout_seconds=20.0`이 설정되어 있었음에도 발동하지 않음 |

## 근본 원인 (2가지 결함의 결합)

### 결함 1 — httpx timeout은 "요청 전체"가 아니라 "read 1회당" 적용

`httpx.Client(timeout=20.0)`의 read timeout은 **소켓 read 한 번당** 20초다.
게이트웨이(OpenRouter)가 keepalive filler를 몇 초 간격으로 계속 흘려보내면
read가 매번 성공해 타임아웃이 리셋되고, 요청은 무한정 살아 있을 수 있다.
이번 건은 그렇게 212초를 버텼다. **"천천히 흘려주는 상대"에 대한 전체
마감시간(deadline)이 코드 어디에도 없었다.**

### 결함 2 — 진단 정보 부족

`VLMError("VLM returned a non-JSON response")`에 응답 본문 정보가 없어,
무엇이 왔는지(filler인지, HTML 에러 페이지인지, 잘린 JSON인지)를 로그만으로
알 수 없었다. 이번 분석도 JSONDecodeError의 line/char 숫자를 역산해서 추정했다.

## 왜 위험한가

- 리랭크는 top_k건을 병렬 실행 후 **전부 끝나야 반환** — 가장 느린 판정 1건이
  /rank 전체 지연을 결정한다. 여러 판정이 동시에 스톨하면 /rank가 분 단위로 묶임.
- 호출자(Spring)는 그 시간 동안 응답을 기다리다 타임아웃 — 사용자 관점에서는
  추천 실패. AI가 폴백으로 "정답"을 만들어도 이미 아무도 기다리지 않는다.
- 스레드 워커와 HTTP 커넥션도 그 시간 동안 점유된다.

## 수정 (이 커밋에 포함)

1. **리랭크 웨이브 전체에 wall-clock 마감시간 도입** — `/rank`·`/search` 공통.
   `RECOMMENDATION_VLM_RERANK_DEADLINE_SECONDS`(기본 30초) 내에 끝나지 않은
   판정은 실패로 간주하고 규칙 점수를 유지(기존 실패 경로 재사용). 마감 후
   executor는 대기 없이 정리한다(진행 중 스레드는 백그라운드에서 자연 종료).
   → 최악의 경우에도 리랭크 추가 지연 ≤ 마감시간.
2. **비-JSON 응답 진단 정보 로깅** — VLMError 메시지에 상태코드·본문 크기·
   본문 앞부분 스니펫 포함.
3. **실패 사유 분리 집계** — 리랭크 INFO 로그를 `failed=N timed_out=M`으로
   분리해 판정 실패와 마감 초과를 구분.

## 재발 방지 메모

- 외부 API 호출에는 "read timeout"과 별개로 **전체 마감시간**이 있는지 항상 확인.
  httpx/requests의 timeout 파라미터는 둘 다 전체 마감이 아니다.
- fallback이 있는 시스템의 실패는 지표·로그로만 보인다 — 실패 카운트에
  **사유 구분**까지 있어야 원인 추적이 빨라진다 (8/1 VLM 전멸 사건과 같은 교훈).
