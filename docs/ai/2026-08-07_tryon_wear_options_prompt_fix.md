# 착장 생성 wearOptions 미반영 수정 — 프롬프트 v3 → v4 (2026-08-07)

- 발견: 2026-08-07 노트 가드(v3) 배포 후 QA
- 증상: extra note에 "셔츠 넣어입기/빼어입기"를 직접 쓰면 반영되는데,
  프론트 UI에서 선택해 `wearOptions`(TopTuck 등 enum)로 들어오는 착용
  방식은 반영되지 않음
- 관련 코드: `ai/app/services/tryon_jobs.py`
- 관련 문서: `2026-08-07_tryon_extra_note_injection_guard.md` (v1→v3 경위)

## 원인

가드레일과 무관한 프롬프트 표현 문제. `wearOptions`는 프롬프트에

```
Styling: top tuck=TUCKED, sleeves=ROLLED.
```

처럼 **raw enum key=value 표기**로 들어갔다. 이미지 모델은 이런 설정값
나열을 착용 지시로 해석하지 못한다. extra note의 "셔츠 넣어입기"는
자연어 문장이라 반영됐던 것 — 같은 의도가 채널(자연어 vs enum 표기)에
따라 반영 여부가 갈린 사례다.

## 수정 (v4, `tryon-fastapi-v4`)

1. **enum → 자연어 지시문 매핑** (`_WEAR_DIRECTIVES`). 백엔드
   `com.ssafy.backend.config.enums.*` 값 6개 전부:

   | enum | 지시문 |
   |---|---|
   | `TopTuck.TUCKED` | tuck the top's hem fully inside the bottoms' waistband |
   | `TopTuck.UNTUCKED` | leave the top's hem untucked, hanging over the bottoms |
   | `OuterClosure.OPEN` | wear the outer layer fully open and unfastened |
   | `OuterClosure.CLOSED` | fasten the outer layer completely closed |
   | `Sleeves.NORMAL` | wear the sleeves straight at their full length |
   | `Sleeves.ROLLED` | roll the sleeves up |

   매핑에 없는 미래 enum 값은 기존처럼 `field=VALUE` 원문으로 전달
   (조용히 사라지지 않게 하는 fallback).

2. **헤더 문구 격상** — `Styling:` → `Wear styling (mandatory, controls
   how the garments are worn):`.

3. **푸터 재강제** — 프롬프트 맨 끝 `Final check` 파트에 "styled exactly
   as the wear styling instructions specify" 추가. 착용 방식이 프롬프트의
   마지막 토큰에서 한 번 더 강제된다.

## 부수 수정 — 테스트 페이로드 계약 불일치

`ai/tests/test_tryon_jobs.py`의 Spring 모사 페이로드가 백엔드에 존재하지
않는 `topTuck: "FULL_TUCK"` 값을 쓰고 있었다. 실제 enum 이름 `TUCKED`로
교정하고, 자연어 변환·미지 값 fallback을 고정하는 테스트를 추가했다.
스키마 쪽은 `top_tuck: str | None`이라 어떤 문자열이든 통과하므로,
백엔드 enum이 바뀌면 이 매핑도 같이 갱신해야 한다.

## 검증

- 전체 스위트 232개 통과 (2026-08-07).
- 배포판 QA: 넣입/빼입 각각 선택해 생성, 이벤트의
  `promptVersion: tryon-fastapi-v4` 확인 후 반영 여부 판정 예정.

## 프롬프트 버전 이력

`v1`(원본) → `v2`(역할 규칙 구조 강화) → `v3`(extra note LLM 가드) →
`v4`(wearOptions 자연어 지시문).
