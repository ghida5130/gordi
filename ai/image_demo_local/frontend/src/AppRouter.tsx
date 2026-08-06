import { useEffect, useState } from 'react'

import EvaluatorGate from './components/EvaluatorGate'
import Round1DashboardPage from './pages/Round1DashboardPage'
import Round1SetupPage from './pages/Round1SetupPage'
import RunPage from './pages/RunPage'
import Round2DashboardPage from './round2/Round2DashboardPage'
import Round2SetupPage from './round2/Round2SetupPage'
import { parseRoute } from './routing'
import { readEvaluatorId, writeEvaluatorId } from './shared/evaluator'

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute())
  useEffect(() => {
    const sync = () => setRoute(parseRoute())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return route
}

export default function AppRouter() {
  const route = useRoute()
  const [evaluatorId, setEvaluatorId] = useState(readEvaluatorId)
  const [draftEvaluatorId, setDraftEvaluatorId] = useState(readEvaluatorId)

  const identify = () => {
    const clean = draftEvaluatorId.trim()
    if (!clean) return
    writeEvaluatorId(clean)
    setEvaluatorId(clean)
    setDraftEvaluatorId(clean)
  }

  const gate = (
    <EvaluatorGate
      value={draftEvaluatorId}
      onChange={setDraftEvaluatorId}
      onSubmit={identify}
    />
  )

  // 2차 입력 화면은 평가자 확인 없이도 열립니다(케이스 준비 전용).
  if (route.name === 'round2-setup') return <Round2SetupPage />

  if (!evaluatorId) return gate

  switch (route.name) {
    case 'run':
      return (
        <RunPage
          runId={route.runId}
          evaluatorId={evaluatorId}
          loadingFallback={gate}
        />
      )
    case 'round1-dashboard':
      return <Round1DashboardPage evaluatorId={evaluatorId} />
    case 'round2-dashboard':
      return <Round2DashboardPage evaluatorId={evaluatorId} />
    default:
      return <Round1SetupPage evaluatorId={evaluatorId} />
  }
}
