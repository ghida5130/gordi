import { scoreLabels } from '../shared/constants'
import type { RankingItem } from '../types'

export default function QualityBreakdown({ ranking }: { ranking: RankingItem[] }) {
  return (
    <section className="stats-section">
      <div className="stats-heading">
        <div><p className="kicker">QUALITY BREAKDOWN</p><h2>팀 품질 점수 통합</h2></div>
        <p>각 후보가 등장한 모든 평가자의 점수를 차원별로 평균했습니다.</p>
      </div>
      <div className="quality-table">
        <div className="quality-head"><span>MODEL</span>{scoreLabels.map((item) => <span key={item.key}>{item.label}</span>)}<span>평가 수</span></div>
        {ranking.map((item) => (
          <div className="quality-row" key={item.provider_id}>
            <span><b>{item.display_name}</b><small>{item.official_model}</small></span>
            {scoreLabels.map((score) => <span key={score.key}>{item.quality_dimensions[score.key].toFixed(2)}</span>)}
            <span>{item.quality_rating_count}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
