# docs/ai — AI 파트 문서 인덱스

AI 파트(FastAPI 서버 `ai/`)의 기능 정리, 회고, 정책, 운영 런북을 모아둔 폴더입니다.

## 기능 ↔ 코드 매핑 (여기부터 읽기)

| 문서 | 내용 |
|---|---|
| [AI_기능_코드_매핑_런타임_서비스.md](AI_기능_코드_매핑_런타임_서비스.md) | 서비스 중에 도는 기능 — 추천(/rank, /search), 가상 피팅(try-on), 아바타 프리셋, 서버 공통 구조 |
| [AI_기능_코드_매핑_데이터_평가.md](AI_기능_코드_매핑_데이터_평가.md) | 오프라인 파이프라인 — 데이터 수집·검수·시드, 임베딩 스냅샷, 평가 하네스(오프라인/TPO/블라인드 A/B) |

## 발표·요약

| 문서 | 내용 |
|---|---|
| [발표자료용_AI_기능_구축_정리.md](발표자료용_AI_기능_구축_정리.md) | 발표자료 제작용 스토리 정리 — A/B 테스트, 파이프라인, TPO 평가, 트러블슈팅, latency |

## 회고 (시간순)

| 문서 | 내용 |
|---|---|
| [2026-07-28_AI_이미지_모델_2차_평가_회고.md](2026-07-28_AI_이미지_모델_2차_평가_회고.md) | 착장 이미지 모델 2차 블라인드 평가 |
| [2026-07-29_AI_이미지_모델_최종_선정_회고.md](2026-07-29_AI_이미지_모델_최종_선정_회고.md) | Nano Banana 2 최종 선정 |
| [2026-07-31_garment_catalog_seed_progress_report.md](2026-07-31_garment_catalog_seed_progress_report.md) | 의류 카탈로그 시드 진행 보고 |
| [2026-08-01_ai_recommendation_daily_retrospective.md](2026-08-01_ai_recommendation_daily_retrospective.md) | 추천 파이프라인 구축 하루 회고 (트러블슈팅·latency) |
| [2026-08-04_ai_ec2_deployment_retrospective.md](2026-08-04_ai_ec2_deployment_retrospective.md) | EC2 배포 회고 (캐시 키·인프라) |
| [2026-08-05_AI_이미지_모델_평가_프로세스_개선안.md](2026-08-05_AI_이미지_모델_평가_프로세스_개선안.md) | 이미지 모델 평가 프로세스 개선안 |
| [2026-08-06_vlm_rerank_selective_gating.md](2026-08-06_vlm_rerank_selective_gating.md) | VLM 리랭크 선택적 게이팅 검증·채택 결정 |
| [2026-08-07_vlm_rerank_hang_incident.md](2026-08-07_vlm_rerank_hang_incident.md) | 버그 판정 — 리랭크 판정 212초 행(hang) 사건 |

## 데이터 수집·확장

| 문서 | 내용 |
|---|---|
| [garment-data-collection-policy-v1.md](garment-data-collection-policy-v1.md) | 수집 정책 v1.1 (레이트리밋·중단 규칙 명문화) |
| [GROK_HANDOVER_DATASET_EXPANSION_2026-08-01.md](GROK_HANDOVER_DATASET_EXPANSION_2026-08-01.md) | 데이터셋 확장 핸드오버 (수집기 사용법) |
| [GROK_HANDOVER_TPO_EXPANSION_2026-08-04.md](GROK_HANDOVER_TPO_EXPANSION_2026-08-04.md) | TPO 균형 확장 핸드오버 |
| [GROK_COLLECTION_COMPLETION_REPORT_TPO_2026-08-05.md](GROK_COLLECTION_COMPLETION_REPORT_TPO_2026-08-05.md) | TPO 확장 수집 종료 보고 (정규화 17,604건) |
| [tpo-tag-vocabulary-v1-draft.md](tpo-tag-vocabulary-v1-draft.md) | TPO 태그 어휘 v1 |

## 운영·배포 런북

| 문서 | 내용 |
|---|---|
| [garment-seed-ec2-runbook.md](garment-seed-ec2-runbook.md) | S3 업로드·EC2 DB 시드 런북 |
| [tpo-15k-deployment-plan.md](tpo-15k-deployment-plan.md) | 15k 카탈로그 배포 계획·실행 기록 |
| [AI_RECOMMENDATION_CICD_ENV_GUIDE.md](AI_RECOMMENDATION_CICD_ENV_GUIDE.md) | CI/CD 환경변수 가이드 |
| [DOCKER_LOCAL_RECOMMENDATION_DEMO_GUIDE.md](DOCKER_LOCAL_RECOMMENDATION_DEMO_GUIDE.md) | 로컬 도커 추천 데모 가이드 |
| [CLAUDE_CODE_HANDOFF_AI_RECOMMENDATION_2026-08-01.md](CLAUDE_CODE_HANDOFF_AI_RECOMMENDATION_2026-08-01.md) | 추천 시스템 핸드오프 (8/1 시점) |

## 코드 쪽 README (심화)

- [ai/README.md](../../ai/README.md) — 서버 실행·환경변수·VLM 플래그
- [ai/eval/README.md](../../ai/eval/README.md) — 평가 방법·baseline 수치·TPO 평가 절차
- [ai/batches/README.md](../../ai/batches/README.md) — 수집 배치 기록
- [ai/image_demo/README.md](../../ai/image_demo/README.md) — 블라인드 A/B 평가 데모
