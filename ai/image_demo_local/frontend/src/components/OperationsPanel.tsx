import { formatCost, formatMs } from '../shared/format'
import type { OperationsSummary } from '../types'

/**
 * 1차·2차 결과 화면과 두 대시보드가 공유합니다.
 * 2차 다크 테마에서는 `.round2-shell` 하위 오버라이드로 색만 바뀝니다.
 */
export default function OperationsPanel({
  operations,
}: {
  operations: OperationsSummary
}) {
  return (
    <section className="stats-section">
      <div className="stats-heading">
        <div><p className="kicker">OPENROUTER OPERATIONS</p><h2>실제 호출 통합 지표</h2></div>
        <p>목업 제외 {operations.real_run_count}개 테스트 · 총비용 ${operations.total_cost_usd.toFixed(4)}</p>
      </div>
      <div className="operations-table">
        <div className="operations-head"><span>MODEL</span><span>호출</span><span>성공률</span><span>평균</span><span>p95</span><span>모델 생성 p95</span><span>평균 비용</span><span>오류</span></div>
        {operations.providers.map((item) => {
          const errors = Object.entries(item.error_categories).map(([key, count]) => `${key} ${count}`).join(', ')
          const skips = Object.entries(item.skip_categories).map(([key, count]) => `${key} ${count}`).join(', ')
          return (
            <div className="operations-row" key={item.provider_id}>
              <span><b>{item.display_name}</b><small>{item.model}{item.is_fallback ? ' · FALLBACK' : ''}</small></span>
              <span>{item.actual_call_count}</span>
              <span>{item.success_rate == null ? '—' : `${item.success_rate}%`}</span>
              <span>{formatMs(item.latency.average_ms)}</span>
              <span>{formatMs(item.latency.p95_ms)}</span>
              <span>{formatMs(item.generation_time.p95_ms)}</span>
              <span>{formatCost(item.cost.average_per_success_usd)}</span>
              <span><small>{errors || skips || '—'}</small></span>
            </div>
          )
        })}
      </div>
      <p className="stats-footnote">비용은 OpenRouter 응답의 usage.cost가 존재하는 성공 건만 합산합니다. 모델 생성시간은 generation 메타데이터가 조회된 건만 계산합니다.</p>
    </section>
  )
}
