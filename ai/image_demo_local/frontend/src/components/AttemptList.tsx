import type { ProviderAttempt } from '../types'

export default function AttemptList({ attempts }: { attempts: ProviderAttempt[] }) {
  return (
    <div className="attempt-list">
      {attempts.map((item) => (
        <div key={item.provider_id}>
          <b>{item.provider_id}</b>
          <span>{item.status}</span>
          <span>{item.latency_ms == null ? '—' : `${item.latency_ms.toLocaleString()} ms`}</span>
          <span>{item.cost_usd == null ? '—' : `$${item.cost_usd.toFixed(4)}`}</span>
          <small>
            {item.error_category || '—'}{item.retryable ? ' · 재시도 가능' : ''}
            {item.error ? ` · ${item.error}` : ''}
          </small>
        </div>
      ))}
    </div>
  )
}
