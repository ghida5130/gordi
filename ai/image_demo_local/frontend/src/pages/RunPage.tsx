import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { getRun, revealRun, saveVote } from '../api'
import AttemptList from '../components/AttemptList'
import ProcessingScreen from '../components/ProcessingScreen'
import BlindComparePage from './BlindComparePage'
import type { VotePayload } from './BlindComparePage'
import RunResultPage from './RunResultPage'
import type { EvaluationRun, RevealResult } from '../types'

const POLL_INTERVAL_MS = 1500
const PENDING_STATUSES = ['QUEUED', 'PROCESSING']

/**
 * run 하나의 전체 수명주기를 담당합니다: 폴링 → 블라인드 비교 → 완료 → 공개.
 * 1차·2차 run 모두 같은 흐름을 쓰고, 라운드별 차이는 run.evaluation_round로만 분기합니다.
 */
export default function RunPage({
  runId,
  evaluatorId,
  loadingFallback,
}: {
  runId: string
  evaluatorId: string
  loadingFallback: ReactNode
}) {
  const [run, setRun] = useState<EvaluationRun | null>(null)
  const [reveal, setReveal] = useState<RevealResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!runId || !evaluatorId) return
    let cancelled = false
    let timer = 0
    const refresh = async () => {
      try {
        const next = await getRun(runId, evaluatorId)
        if (cancelled) return
        setRun(next)
        if (PENDING_STATUSES.includes(next.status)) {
          timer = window.setTimeout(refresh, POLL_INTERVAL_MS)
        }
      } catch (reason) {
        if (!cancelled) setError((reason as Error).message)
      }
    }
    void refresh()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [runId, evaluatorId])

  const pendingPairs = useMemo(
    () => run?.pairs.filter((pair) => !run.voted_pair_ids.includes(pair.pair_id)) || [],
    [run],
  )
  const currentPair = pendingPairs[0]
  const completed = run ? run.pair_count - pendingPairs.length : 0
  const isRoundTwo = run?.evaluation_round === 2

  const handleVote = useCallback(async (vote: VotePayload) => {
    if (!run) return
    setBusy(true)
    setError('')
    try {
      await saveVote({
        runId: run.run_id,
        pairId: vote.pairId,
        evaluatorId,
        winner: vote.winner,
        leftScores: vote.leftScores,
        rightScores: vote.rightScores,
        note: vote.note,
      })
      setRun(await getRun(run.run_id, evaluatorId))
    } catch (reason) {
      setError((reason as Error).message)
      throw reason
    } finally {
      setBusy(false)
    }
  }, [evaluatorId, run])

  const handleReveal = async () => {
    if (!run) return
    setBusy(true)
    try {
      setReveal(await revealRun(run.run_id))
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!run) return <>{loadingFallback}</>

  if (PENDING_STATUSES.includes(run.status)) {
    return (
      <ProcessingScreen
        kicker={`${isRoundTwo ? 'ROUND 02 · ' : ''}RUN ${run.run_id.slice(0, 8).toUpperCase()}`}
        title="후보 이미지를 생성하고 있습니다."
        description={
          isRoundTwo
            ? '상위 4개 모델의 응답이 모두 모일 때까지 모델 정보와 개별 처리시간은 표시하지 않습니다.'
            : '모든 응답이 모일 때까지 모델 정보와 개별 처리시간은 표시하지 않습니다.'
        }
        footnote={run.mock_mode ? '목업 출력을 준비하는 중' : '설정된 OpenRouter 모델을 병렬 호출하는 중'}
      />
    )
  }

  if (run.status === 'INSUFFICIENT_RESULTS') {
    return (
      <main className="gate-shell">
        <p className="kicker">RUN INCOMPLETE</p>
        <h1>비교할 결과가 부족합니다.</h1>
        <p>
          {isRoundTwo
            ? '공정한 비교에 필요한 상위 4개 모델의 출력이 모두 모이지 않았습니다. 공개 리포트에서 실패한 공급자를 확인한 뒤 다시 실행해 주세요.'
            : '상용 API와 FLUX 폴백을 포함해 성공한 출력이 2개 미만입니다. 공개 리포트에서 실패 원인을 확인하세요.'}
        </p>
        <button className="primary-button" onClick={handleReveal}>실패 리포트 보기</button>
        {reveal && <AttemptList attempts={reveal.attempts} />}
      </main>
    )
  }

  if (reveal) return <RunResultPage result={reveal} run={run} />

  if (!currentPair) {
    return (
      <main className="gate-shell complete-shell">
        <p className="kicker">EVALUATION COMPLETE</p>
        <h1>모든 비교를 마쳤습니다.</h1>
        <p>{completed}개 쌍의 평가가 저장됐습니다. 공개하면 팀 전체 투표를 합산해 최선과 차선을 계산합니다.</p>
        <button className="primary-button" disabled={busy} onClick={handleReveal}>모델 공개 &amp; 결과 보기 <span>→</span></button>
      </main>
    )
  }

  return (
    <BlindComparePage
      key={currentPair.pair_id}
      run={run}
      pair={currentPair}
      completed={completed}
      evaluatorId={evaluatorId}
      busy={busy}
      error={error}
      onSubmit={handleVote}
    />
  )
}
