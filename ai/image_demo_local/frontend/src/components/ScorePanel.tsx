import { scoreLabels } from '../shared/constants'
import type { CandidateScore } from '../types'

export default function ScorePanel({
  title,
  value,
  onChange,
}: {
  title: string
  value: CandidateScore
  onChange: (next: CandidateScore) => void
}) {
  return (
    <div className="score-panel">
      <div className="score-title">{title}</div>
      {scoreLabels.map((item) => (
        <div className="score-row" key={item.key}>
          <span>
            {item.label}
            <small>{item.hint}</small>
          </span>
          <div className="score-buttons" aria-label={`${title} ${item.label}`}>
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                type="button"
                className={value[item.key] === score ? 'active' : ''}
                key={score}
                onClick={() => onChange({ ...value, [item.key]: score })}
              >
                {score}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
