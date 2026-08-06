import type { TeamSummary } from '../types'

export default function TeamSummaryPanel({ team }: { team: TeamSummary }) {
  return (
    <section className="stats-section">
      <div className="stats-heading">
        <div><p className="kicker">TEAM EVALUATION</p><h2>팀 통합 평가 현황</h2></div>
        <p>{team.completed_evaluator_count} / {team.evaluator_count}명 완료 · 전체 진행률 {team.completion_rate}%</p>
      </div>
      <div className="metric-cards">
        <div><small>평가 참여자</small><b>{team.evaluator_count}</b><span>명</span></div>
        <div><small>완료 참여자</small><b>{team.completed_evaluator_count}</b><span>명</span></div>
        <div><small>저장된 평가</small><b>{team.submitted_votes}</b><span>표</span></div>
        <div><small>비교 쌍</small><b>{team.pair_count}</b><span>쌍</span></div>
      </div>
      <div className="participant-list">
        {team.participants.map((item) => (
          <div key={item.evaluator_id}>
            <b>{item.evaluator_id}</b>
            <span>{item.completed_pairs} / {item.required_pairs}</span>
            <span>{item.completion_rate}%</span>
            <small className={item.completed ? 'done' : ''}>{item.completed ? '완료' : '진행 중'}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
