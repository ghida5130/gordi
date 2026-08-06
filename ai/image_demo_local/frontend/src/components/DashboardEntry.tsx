import { navigate } from '../routing'
import type { AppRoute } from '../routing'

export default function DashboardEntry({
  kicker = 'TEAM INSIGHT · ALL REAL RUNS',
  title = '통합 모델 평가 대시보드',
  description = '실제 테스트 케이스의 팀 투표, 모델별 품질 점수와 API 운영 지표를 한 번에 확인합니다.',
  actionLabel = '통합 대시보드 보기',
  to,
}: {
  kicker?: string
  title?: string
  description?: string
  actionLabel?: string
  to: AppRoute
}) {
  return (
    <section className="dashboard-entry">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button className="primary-button" type="button" onClick={() => navigate(to)}>
        {actionLabel} <span>→</span>
      </button>
    </section>
  )
}
