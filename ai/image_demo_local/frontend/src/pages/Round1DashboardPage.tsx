import OperationsPanel from '../components/OperationsPanel'
import ProcessingScreen from '../components/ProcessingScreen'
import { navigate, routeHref } from '../routing'
import { ADVANCING_MODEL_COUNT, scoreLabels } from '../shared/constants'
import { formatDateTime, padRank } from '../shared/format'
import { useDashboard } from '../shared/useDashboard'
import type { DashboardRunItem, IntegratedDashboard } from '../types'

export function DashboardRunCard({ item }: { item: DashboardRunItem }) {
  return (
    <article>
      <div>
        <small>{formatDateTime(item.created_at)} · RUN {item.run_id.slice(0, 8).toUpperCase()}</small>
        <h3>{item.scenario_name}</h3>
      </div>
      <dl>
        <div><dt>후보</dt><dd>{item.candidate_count}</dd></div>
        <div><dt>참여자</dt><dd>{item.team_evaluator_count}명</dd></div>
        <div><dt>팀 평가</dt><dd>{item.team_vote_count}표</dd></div>
        <div><dt>현재 1위</dt><dd>{item.top_model || '집계 전'}</dd></div>
      </dl>
      <span className={item.evaluator_completed ? 'run-complete' : 'run-pending'}>
        {item.evaluator_completed
          ? '내 평가 완료'
          : `${item.evaluator_vote_count}/${item.evaluator_required_vote_count} 진행`}
      </span>
      {!item.evaluator_completed && (
        <a
          className="run-evaluate-link"
          href={routeHref({ name: 'run', runId: item.run_id })}
        >
          평가 계속하기 <span>→</span>
        </a>
      )}
    </article>
  )
}

/** 대시보드 조회 자격이 없거나 요청이 실패했을 때의 안내 화면. */
export function DashboardNotice({
  needsEvaluation,
  message,
  onBack,
}: {
  needsEvaluation: boolean
  message: string
  onBack: () => void
}) {
  return (
    <main className="gate-shell">
      <p className="kicker">DASHBOARD UNAVAILABLE</p>
      <h1>{needsEvaluation ? '아직 집계할 평가가 없어요.' : '대시보드를 불러오지 못했습니다.'}</h1>
      <p>
        {needsEvaluation
          ? '목업이 아닌 실제 테스트 케이스를 하나 이상 끝까지 평가하면 통합 대시보드가 열립니다.'
          : message}
      </p>
      <button className="primary-button" type="button" onClick={onBack}>
        모델 랩으로 돌아가기 <span>→</span>
      </button>
    </main>
  )
}

function DashboardView({ dashboard }: { dashboard: IntegratedDashboard }) {
  const advancingModels = dashboard.ranking.slice(0, ADVANCING_MODEL_COUNT)
  const eliminatedModels = dashboard.ranking.slice(ADVANCING_MODEL_COUNT)
  const completedRuns = dashboard.runs.filter((item) => item.evaluator_completed)
  const pendingRuns = dashboard.runs.filter((item) => !item.evaluator_completed)
  const cutoffModel = advancingModels.at(-1)
  const firstEliminatedModel = eliminatedModels[0]
  const cutoffGap = cutoffModel && firstEliminatedModel
    ? (cutoffModel.composite_score - firstEliminatedModel.composite_score).toFixed(1)
    : null
  const hasUnevenCoverage = dashboard.ranking.some(
    (item) => item.case_count !== dashboard.evaluated_run_count,
  )

  return (
    <main className="result-shell dashboard-shell">
      <header className="topbar">
        <div className="brand"><span>G</span><b>GORDI</b> / DASHBOARD</div>
        <button
          className="text-button"
          type="button"
          onClick={() => navigate({ name: 'round1-setup' })}
        >
          ← 모델 랩으로 돌아가기
        </button>
      </header>
      <section className="dashboard-hero">
        <div>
          <p className="kicker">ROUND 01 · SELECTION RESULT</p>
          <h1>{dashboard.ranking.length}개에서<br />{ADVANCING_MODEL_COUNT}개로.</h1>
        </div>
        <div className="dashboard-decision">
          <span>2차 테스트 진출</span>
          <b>{advancingModels.map((item) => item.display_name).join(' · ')}</b>
          <p>
            목업을 제외한 실제 Run과 현재까지 저장된 팀 평가를 합산했습니다.
            종합점수 상위 {ADVANCING_MODEL_COUNT}개 모델을 2차 후보로 표시합니다.
          </p>
          <small>VIEWER · {dashboard.evaluator_id}</small>
          <a className="run-evaluate-link" href={routeHref({ name: 'round2-setup' })}>
            2차 테스트 시작하기 <span>→</span>
          </a>
        </div>
      </section>

      <section className="metric-cards dashboard-metrics">
        <div><small>집계 RUN</small><b>{dashboard.evaluated_run_count}</b><span>개</span></div>
        <div><small>누적 팀 평가</small><b>{dashboard.total_team_votes}</b><span>표</span></div>
        <div><small>비교 모델</small><b>{dashboard.ranking.length}</b><span>개</span></div>
        <div className="advance-metric"><small>2차 진출</small><b>{advancingModels.length}</b><span>개</span></div>
      </section>

      <section className="stats-section selection-section">
        <div className="stats-heading">
          <div><p className="kicker">ADVANCING TO ROUND 02</p><h2>2차 테스트 진출 모델</h2></div>
          <p>종합점수 = 비교 선호도 60% + 4개 품질 항목 평균 40%</p>
        </div>
        <div className="advancing-grid">
          {advancingModels.map((item, index) => (
            <article key={item.provider_id}>
              <div className="advance-card-head">
                <span>{padRank(index + 1)}</span>
                <small>ROUND 02</small>
              </div>
              <h3>{item.display_name}</h3>
              <p>{item.official_model}</p>
              <div className="advance-score">
                <b>{item.composite_score}</b>
                <span>/ 100</span>
              </div>
              <div className="score-meter" aria-label={`종합점수 ${item.composite_score}점`}>
                <i style={{ width: `${item.composite_score}%` }} />
              </div>
              <dl>
                <div><dt>선호도</dt><dd>{item.preference_score}%</dd></div>
                <div><dt>품질</dt><dd>{item.quality_average.toFixed(2)}</dd></div>
                <div><dt>승 / 무 / 패</dt><dd>{item.wins} / {item.ties} / {item.losses}</dd></div>
                <div><dt>표본</dt><dd>{item.case_count} cases · {item.quality_rating_count} ratings</dd></div>
              </dl>
              <div className="quality-chips">
                {scoreLabels.map((score) => (
                  <span key={score.key}>
                    {score.label}<b>{item.quality_dimensions[score.key].toFixed(2)}</b>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="selection-summary">
          {cutoffModel && firstEliminatedModel && (
            <>
              통과선은 <b>{cutoffModel.display_name} {cutoffModel.composite_score}점</b>이며,
              {ADVANCING_MODEL_COUNT + 1}위({firstEliminatedModel.display_name} {firstEliminatedModel.composite_score}점)보다
              <b> {cutoffGap}점</b> 높습니다.
            </>
          )}
          {hasUnevenCoverage && (
            <> 모델별 호출 성공 여부에 따라 집계된 Run 수는 다를 수 있습니다.</>
          )}
        </p>
      </section>

      <section className="stats-section">
        <div className="stats-heading">
          <div>
            <p className="kicker">FULL RANKING · {dashboard.ranking.length} MODELS</p>
            <h2>1차 평가 전체 순위</h2>
          </div>
          <p>표본 수와 승패 기록을 함께 확인해 모델별 결과를 비교할 수 있습니다.</p>
        </div>
        <div className="dashboard-ranking">
          <div className="dashboard-ranking-head">
            <span>결정</span><span>RANK</span><span>MODEL</span><span>TOTAL</span><span>선호도</span><span>품질</span><span>승 / 무 / 패</span><span>표본</span>
          </div>
          {dashboard.ranking.map((item, index) => (
            <div
              className={`dashboard-ranking-row ${index < ADVANCING_MODEL_COUNT ? 'is-advancing' : 'is-eliminated'} ${index === ADVANCING_MODEL_COUNT ? 'selection-cutline' : ''}`}
              key={item.provider_id}
            >
              <span className="decision-badge">
                {index < ADVANCING_MODEL_COUNT ? '통과' : '제외'}
              </span>
              <span>{padRank(index + 1)}</span>
              <span><b>{item.display_name}</b><small>{item.official_model}</small></span>
              <span><b>{item.composite_score}</b></span>
              <span>{item.preference_score}%</span>
              <span>{item.quality_average.toFixed(2)}</span>
              <span>{item.wins} / {item.ties} / {item.losses}</span>
              <span>{item.case_count} cases<small>{item.quality_rating_count} ratings</small></span>
            </div>
          ))}
        </div>
        <p className="stats-footnote">
          승률만으로 순위를 정하지 않습니다. 무승부는 0.5승으로 반영하며,
          품질 점수는 평가 횟수로 가중 평균합니다. ‘둘 다 아님’ 응답은 선호도 분모에는 포함되지만 승점은 부여하지 않습니다.
        </p>
      </section>

      <section className="stats-section">
        <div className="stats-heading">
          <div><p className="kicker">ROUND 01 · TEST CASES</p><h2>Run 데이터 현황</h2></div>
          <p>
            내 평가 완료 {completedRuns.length}개 · 미완료 {pendingRuns.length}개 ·
            전체 실제 Run {dashboard.real_run_count}개
          </p>
        </div>
        {pendingRuns.length > 0 && (
          <div className="run-group">
            <div className="run-group-heading">
              <h3>내 미완료 Run</h3>
              <span>{pendingRuns.length}</span>
              <p>계속 평가하면 팀 집계에 즉시 반영됩니다.</p>
            </div>
            <div className="dashboard-runs">
              {pendingRuns.map((item) => <DashboardRunCard item={item} key={item.run_id} />)}
            </div>
          </div>
        )}
        <div className="run-group">
          <div className="run-group-heading">
            <h3>내 평가 완료 Run</h3>
            <span>{completedRuns.length}</span>
          </div>
          <div className="dashboard-runs">
            {completedRuns.map((item) => <DashboardRunCard item={item} key={item.run_id} />)}
          </div>
        </div>
      </section>

      <details className="dashboard-operations">
        <summary>
          <span><b>API 운영 지표</b> · 호출 성공률, 지연시간, 비용 상세</span>
          <small>총비용 ${dashboard.operations.total_cost_usd.toFixed(4)} · 펼쳐 보기</small>
        </summary>
        <OperationsPanel operations={dashboard.operations} />
      </details>
    </main>
  )
}

export default function Round1DashboardPage({
  evaluatorId,
}: {
  evaluatorId: string
}) {
  const { dashboard, busy, error, needsEvaluation } = useDashboard(evaluatorId, 1)

  if (error) {
    return (
      <DashboardNotice
        needsEvaluation={needsEvaluation}
        message={error}
        onBack={() => navigate({ name: 'round1-setup' })}
      />
    )
  }
  if (busy || !dashboard) {
    return (
      <ProcessingScreen
        kicker="INTEGRATED DASHBOARD"
        title="실제 테스트 결과를 합산하고 있습니다."
        description="목업 run을 제외하고 모델별 품질·선호도·운영 지표를 계산합니다."
      />
    )
  }
  return <DashboardView dashboard={dashboard} />
}
