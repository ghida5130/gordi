import OperationsPanel from '../components/OperationsPanel'
import { routeHref } from '../routing'
import { scoreLabels } from '../shared/constants'
import { formatDateTime, padRank } from '../shared/format'
import { useDashboard } from '../shared/useDashboard'
import type {
  DashboardRankingItem,
  DashboardRunItem,
  IntegratedDashboard,
} from '../types'
import { round2Models } from './presets'
import './round2.css'
import './round2Dashboard.css'

function Round2Topbar() {
  return (
    <header className="round2-topbar">
      <a className="round2-brand" href={routeHref({ name: 'round1-setup' })}>
        <span>G</span>
        <b>GORDI</b>
        <small>MODEL LAB / ROUND 02 RESULT</small>
      </a>
      <nav aria-label="평가 단계 이동">
        <a href={routeHref({ name: 'round1-setup' })}>1차 페이지</a>
        <a href={routeHref({ name: 'round1-dashboard' })}>1차 결과</a>
        <a href={routeHref({ name: 'round2-setup' })}>2차 입력</a>
      </nav>
    </header>
  )
}

function Round2Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="round2-shell round2-dashboard-shell">
      <Round2Topbar />
      {children}
    </main>
  )
}

function Round2RankCard({
  item,
  index,
}: {
  item: DashboardRankingItem
  index: number
}) {
  return (
    <article className={index === 0 ? 'is-final' : undefined}>
      <div className="round2-rank-head">
        <span>{padRank(index + 1)}</span>
        <small>{index === 0 ? 'FINAL PICK' : 'ROUND 02'}</small>
      </div>
      <h3>{item.display_name}</h3>
      <code>{item.official_model}</code>
      <div className="round2-rank-score">
        <b>{item.composite_score}</b>
        <span>/ 100</span>
      </div>
      <div className="round2-rank-meter" aria-label={`종합점수 ${item.composite_score}점`}>
        <i style={{ width: `${item.composite_score}%` }} />
      </div>
      <dl>
        <div><dt>선호도</dt><dd>{item.preference_score}%</dd></div>
        <div><dt>품질</dt><dd>{item.quality_average.toFixed(2)}</dd></div>
        <div><dt>승 / 무 / 패</dt><dd>{item.wins} / {item.ties} / {item.losses}</dd></div>
        <div><dt>표본</dt><dd>{item.case_count} cases · {item.quality_rating_count} ratings</dd></div>
      </dl>
      <div className="round2-rank-chips">
        {scoreLabels.map((score) => (
          <span key={score.key}>
            {score.label}<b>{item.quality_dimensions[score.key].toFixed(2)}</b>
          </span>
        ))}
      </div>
    </article>
  )
}

function Round2RunCard({ item }: { item: DashboardRunItem }) {
  return (
    <article>
      <small>{formatDateTime(item.created_at)} · RUN {item.run_id.slice(0, 8).toUpperCase()}</small>
      <h3>{item.scenario_name}</h3>
      <span className={item.evaluator_completed ? 'is-complete' : 'is-pending'}>
        {item.evaluator_completed
          ? '내 평가 완료'
          : `${item.evaluator_vote_count}/${item.evaluator_required_vote_count} 진행`}
      </span>
      <dl>
        <div><dt>후보</dt><dd>{item.candidate_count}</dd></div>
        <div><dt>참여자</dt><dd>{item.team_evaluator_count}명</dd></div>
        <div><dt>팀 평가</dt><dd>{item.team_vote_count}표</dd></div>
        <div><dt>현재 1위</dt><dd>{item.top_model || '집계 전'}</dd></div>
      </dl>
      {!item.evaluator_completed && (
        <a
          className="round2-run-link"
          href={routeHref({ name: 'run', runId: item.run_id })}
        >
          평가 계속하기 <span>→</span>
        </a>
      )}
    </article>
  )
}

function Round2DashboardView({ dashboard }: { dashboard: IntegratedDashboard }) {
  const finalPick = dashboard.ranking[0]
  const runnerUp = dashboard.ranking[1]
  const completedRuns = dashboard.runs.filter((item) => item.evaluator_completed)
  const pendingRuns = dashboard.runs.filter((item) => !item.evaluator_completed)
  const gap = finalPick && runnerUp
    ? (finalPick.composite_score - runnerUp.composite_score).toFixed(1)
    : null
  // 1차에서 올라온 4개 후보 중 아직 집계 표본이 없는 모델.
  const missingModels = round2Models.filter(
    (model) => !dashboard.ranking.some((item) => item.provider_id === model.providerId),
  )

  return (
    <Round2Shell>
      <section className="round2-hero">
        <div>
          <p className="round2-kicker">ROUND 02 · FIT-AWARE RESULT</p>
          <h1>
            4개에서
            <br />
            1개로.
          </h1>
        </div>
        <div className="round2-hero-note">
          <span>현재 선두</span>
          <p>
            {finalPick
              ? `${finalPick.display_name}이(가) 종합 ${finalPick.composite_score}점으로 1위입니다.`
              : '아직 집계된 2차 평가가 없습니다.'}
            {' '}목업을 제외한 2차 실제 Run만 합산하며, 실측 기반 프롬프트(v2)로 생성된 결과입니다.
          </p>
          <dl>
            <div><dt>프로필</dt><dd>{dashboard.evaluation_profile}</dd></div>
            <div><dt>집계 RUN</dt><dd>{dashboard.evaluated_run_count}</dd></div>
            <div><dt>VIEWER</dt><dd>{dashboard.evaluator_id}</dd></div>
          </dl>
        </div>
      </section>

      <section className="round2-metrics">
        <div><small>집계 RUN</small><b>{dashboard.evaluated_run_count}</b><span>개</span></div>
        <div><small>누적 팀 평가</small><b>{dashboard.total_team_votes}</b><span>표</span></div>
        <div><small>비교 모델</small><b>{dashboard.ranking.length}</b><span>개</span></div>
        <div className="is-highlight"><small>선두 격차</small><b>{gap ?? '—'}</b><span>점</span></div>
      </section>

      <section className="round2-panel">
        <div className="round2-section-title">
          <span>01</span>
          <div>
            <p className="round2-kicker">FINAL CANDIDATES</p>
            <h2>2차 후보 종합 순위</h2>
          </div>
          <small>종합점수 = 선호도 60% + 품질 평균 40%</small>
        </div>
        {dashboard.ranking.length ? (
          <div className="round2-rank-grid">
            {dashboard.ranking.map((item, index) => (
              <Round2RankCard item={item} index={index} key={item.provider_id} />
            ))}
          </div>
        ) : (
          <p className="round2-empty">
            2차 Run에 저장된 평가가 아직 없어 순위를 계산할 수 없습니다.
          </p>
        )}
        {missingModels.length > 0 && (
          <p className="round2-note">
            아직 표본이 없는 후보: {missingModels.map((model) => model.displayName).join(' · ')}
          </p>
        )}
      </section>

      <section className="round2-panel">
        <div className="round2-section-title">
          <span>02</span>
          <div>
            <p className="round2-kicker">DIMENSION BREAKDOWN</p>
            <h2>품질 항목별 점수</h2>
          </div>
          <small>평가 횟수로 가중 평균한 값입니다.</small>
        </div>
        <div className="round2-table-scroll">
          <div className="round2-quality-head">
            <span>MODEL</span>
            {scoreLabels.map((item) => <span key={item.key}>{item.label}</span>)}
            <span>평가 수</span>
          </div>
          {dashboard.ranking.map((item) => (
            <div className="round2-quality-row" key={item.provider_id}>
              <span><b>{item.display_name}</b><small>{item.official_model}</small></span>
              {scoreLabels.map((score) => (
                <span key={score.key}>{item.quality_dimensions[score.key].toFixed(2)}</span>
              ))}
              <span>{item.quality_rating_count}</span>
            </div>
          ))}
        </div>
        <p className="round2-note">
          무승부는 0.5승으로 반영하며, ‘둘 다 아님’ 응답은 선호도 분모에는 포함되지만 승점은 부여하지 않습니다.
        </p>
      </section>

      <section className="round2-panel">
        <div className="round2-section-title">
          <span>03</span>
          <div>
            <p className="round2-kicker">ROUND 02 · TEST CASES</p>
            <h2>Run 데이터 현황</h2>
          </div>
          <small>
            내 완료 {completedRuns.length}개 · 미완료 {pendingRuns.length}개 ·
            {' '}전체 실제 Run {dashboard.real_run_count}개
          </small>
        </div>
        {pendingRuns.length > 0 && (
          <>
            <h4 className="round2-run-group">내 미완료 Run</h4>
            <div className="round2-run-grid">
              {pendingRuns.map((item) => <Round2RunCard item={item} key={item.run_id} />)}
            </div>
          </>
        )}
        <h4 className="round2-run-group">내 평가 완료 Run</h4>
        {completedRuns.length ? (
          <div className="round2-run-grid">
            {completedRuns.map((item) => <Round2RunCard item={item} key={item.run_id} />)}
          </div>
        ) : (
          <p className="round2-empty">완료한 2차 Run이 없습니다.</p>
        )}
      </section>

      <details className="round2-operations">
        <summary>
          <span><b>API 운영 지표</b> · 호출 성공률, 지연시간, 비용 상세</span>
          <small>총비용 ${dashboard.operations.total_cost_usd.toFixed(4)} · 펼쳐 보기</small>
        </summary>
        <OperationsPanel operations={dashboard.operations} />
      </details>
    </Round2Shell>
  )
}

export default function Round2DashboardPage({
  evaluatorId,
}: {
  evaluatorId: string
}) {
  const { dashboard, busy, error, needsEvaluation } = useDashboard(evaluatorId, 2)

  if (error) {
    return (
      <Round2Shell>
        <section className="round2-dash-notice">
          <p className="round2-kicker">DASHBOARD UNAVAILABLE</p>
          <h1>{needsEvaluation ? '아직 집계할 2차 평가가 없어요.' : '대시보드를 불러오지 못했습니다.'}</h1>
          <p>
            {needsEvaluation
              ? '목업이 아닌 2차 테스트 케이스를 하나 이상 끝까지 평가하면 통합 결과가 열립니다.'
              : error}
          </p>
          <a href={routeHref({ name: 'round2-setup' })}>
            2차 입력으로 이동 <span>→</span>
          </a>
        </section>
      </Round2Shell>
    )
  }

  if (busy || !dashboard) {
    return (
      <Round2Shell>
        <section className="round2-dash-notice">
          <p className="round2-kicker">ROUND 02 · INTEGRATED DASHBOARD</p>
          <h1>2차 결과를 합산하고 있습니다.</h1>
          <p>목업 run을 제외하고 4개 후보의 선호도·품질·운영 지표를 계산합니다.</p>
          <div className="round2-dash-bar"><i /></div>
        </section>
      </Round2Shell>
    )
  }

  return <Round2DashboardView dashboard={dashboard} />
}
