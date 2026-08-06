import { useEffect, useState } from 'react'

import { getDashboard } from '../api'
import type { EvaluationRoundNumber } from '../routing'
import type { IntegratedDashboard } from '../types'

const INCOMPLETE_HINT = '블라인드 테스트를 먼저 완료'

export interface DashboardState {
  dashboard: IntegratedDashboard | null
  busy: boolean
  error: string
  /** 평가 이력이 없어 집계 자격이 없는 경우. 오류가 아니라 안내로 보여줍니다. */
  needsEvaluation: boolean
}

/** 1차·2차 대시보드가 공유하는 조회 훅. evaluatorId가 비어 있으면 요청하지 않습니다. */
export function useDashboard(
  evaluatorId: string,
  round: EvaluationRoundNumber,
): DashboardState {
  const [dashboard, setDashboard] = useState<IntegratedDashboard | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const clean = evaluatorId.trim()
    if (!clean) {
      setDashboard(null)
      setError('')
      return
    }
    let cancelled = false
    setBusy(true)
    setError('')
    getDashboard(clean, round)
      .then((result) => {
        if (!cancelled) setDashboard(result)
      })
      .catch((reason) => {
        if (!cancelled) setError((reason as Error).message)
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [evaluatorId, round])

  return {
    dashboard,
    busy,
    error,
    needsEvaluation: error.includes(INCOMPLETE_HINT),
  }
}
