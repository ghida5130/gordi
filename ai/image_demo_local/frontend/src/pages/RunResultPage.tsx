import AttemptList from '../components/AttemptList'
import DashboardEntry from '../components/DashboardEntry'
import OperationsPanel from '../components/OperationsPanel'
import QualityBreakdown from '../components/QualityBreakdown'
import TeamSummaryPanel from '../components/TeamSummaryPanel'
import { padRank } from '../shared/format'
import type { EvaluationRun, RankingItem, RevealResult } from '../types'

function PodiumCard({
  rank,
  label,
  item,
}: {
  rank: string
  label: string
  item: RankingItem
}) {
  return (
    <article className="podium-card">
      <span className="podium-rank">{rank}</span>
      <p>{label}</p>
      <h2>{item.display_name}</h2>
      <small>{item.official_model} · {item.input_strategy}</small>
      <div><b>{item.composite_score}</b><span>/ 100</span></div>
    </article>
  )
}

export default function RunResultPage({
  result,
  run,
}: {
  result: RevealResult
  run: EvaluationRun
}) {
  const shareUrl = `${window.location.origin}?run=${run.run_id}`
  const isRoundTwo = run.evaluation_round === 2

  return (
    <main className="result-shell">
      <header className="topbar">
        <div className="brand">
          <span>G</span><b>GORDI</b> / {isRoundTwo ? 'ROUND 02 · RESULT' : 'RESULT'}
        </div>
        <button className="text-button" onClick={() => navigator.clipboard.writeText(shareUrl)}>평가 링크 복사</button>
      </header>
      <section className="result-hero">
        <p className="kicker">REVEALED · {run.scenario_name}</p>
        <h1>최선과 차선이<br />드러났습니다.</h1>
        <p>선호 승률 60%와 4개 품질 지표 평균 40%를 합산한 결과입니다.</p>
        {result.mock_mode && <div className="mock-warning">목업 데이터입니다. 실제 모델 품질 선정에 사용하지 마세요.</div>}
      </section>
      <section className="podium">
        {result.best && <PodiumCard rank="01" label="BEST" item={result.best} />}
        {result.runner_up && <PodiumCard rank="02" label="RUNNER-UP" item={result.runner_up} />}
      </section>
      <TeamSummaryPanel team={result.team_summary} />
      <section className="ranking-table">
        <div className="table-head"><span>RANK</span><span>MODEL</span><span>INPUT</span><span>PREFERENCE</span><span>QUALITY</span><span>TOTAL</span></div>
        {result.ranking.map((item, index) => (
          <div className="table-row" key={item.provider_id}>
            <span>{padRank(index + 1)}</span>
            <span><b>{item.display_name}</b><small>{item.official_model}</small></span>
            <span>{item.input_strategy}</span>
            <span>{item.preference_score}%</span>
            <span>{item.quality_average.toFixed(2)} / 5</span>
            <span><b>{item.composite_score}</b></span>
          </div>
        ))}
      </section>
      <QualityBreakdown ranking={result.ranking} />
      <OperationsPanel operations={result.operations} />
      <details className="attempt-details">
        <summary>공급자 호출 진단</summary>
        <AttemptList attempts={result.attempts} />
      </details>
      {isRoundTwo ? (
        <DashboardEntry
          to={{ name: 'round2-dashboard' }}
          kicker="ROUND 02 · TEAM INSIGHT"
          title="2차 통합 결과 대시보드"
          description="2차 실제 Run만 모아 4개 후보의 팀 선호도·품질 점수와 호출 지표를 합산합니다."
          actionLabel="2차 대시보드 보기"
        />
      ) : (
        <DashboardEntry to={{ name: 'round1-dashboard' }} />
      )}
    </main>
  )
}
