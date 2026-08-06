import type { CandidateScore, ScoreKey, Slot } from '../types'

export const scoreLabels: Array<{ key: ScoreKey; label: string; hint: string }> = [
  { key: 'garment_fidelity', label: '의류 보존', hint: '색·패턴·로고·기장' },
  { key: 'body_fidelity', label: '체형 보존', hint: '실루엣·비율·포즈' },
  { key: 'realism', label: '자연스러움', hint: '착용감·조명·주름' },
  { key: 'artifact_control', label: '결함 억제', hint: '손·겹침·잔상' },
]

export const slotLabels: Record<Slot, string> = {
  TOP: '상의',
  BOTTOM: '하의',
  OUTER: '아우터',
  DRESS: '원피스',
}

export const initialScore = (): CandidateScore => ({
  garment_fidelity: 3,
  body_fidelity: 3,
  realism: 3,
  artifact_control: 3,
})

/** 1차 대시보드에서 2차로 진출시키는 상위 모델 수. 서버 ROUND_2 프로필과 같은 값이어야 합니다. */
export const ADVANCING_MODEL_COUNT = 4
