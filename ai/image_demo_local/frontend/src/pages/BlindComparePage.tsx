import { useState } from 'react'

import { mediaUrl } from '../api'
import HoverZoomImage from '../components/HoverZoomImage'
import ScorePanel from '../components/ScorePanel'
import { initialScore, slotLabels } from '../shared/constants'
import { padRank } from '../shared/format'
import type { CandidateScore, EvaluationRun, Pair } from '../types'

export type Winner = 'LEFT' | 'RIGHT' | 'TIE' | 'NEITHER'

export interface VotePayload {
  pairId: string
  winner: Winner
  leftScores: CandidateScore
  rightScores: CandidateScore
  note: string
}

/** 서버가 확정한 핏 목표. 2차 run에서만 표시합니다. */
function Round2FitBrief({ run }: { run: EvaluationRun }) {
  return (
    <section className="round2-eval-brief" aria-label="2차 평가 핏 기준">
      <div>
        <span>SERVER FIT TARGET</span>
        <b>선택 사이즈 기준 평가 목표</b>
        <small>relative-fit-v1 · 화면 태그가 아니라 서버 확정값</small>
      </div>
      <div className="round2-eval-garments">
        {run.references.garments.map((item) => (
          <article key={item.image_url}>
            <header>
              <b>{slotLabels[item.slot]}</b>
              <span>{item.selected_size || 'SIZE 미지정'}</span>
              {item.reference_type === 'worn-reference' && <em>착용컷 · 인물 무시</em>}
            </header>
            <p>{item.caption}</p>
            <div>
              {item.fit_assessment?.summary_tags.length
                ? item.fit_assessment.summary_tags.map((tag) => <span key={tag}>{tag}</span>)
                : <small>확정된 핏 태그 없음</small>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function BlindComparePage({
  run,
  pair,
  completed,
  evaluatorId,
  busy,
  error,
  onSubmit,
}: {
  run: EvaluationRun
  pair: Pair
  completed: number
  evaluatorId: string
  busy: boolean
  error: string
  onSubmit: (vote: VotePayload) => Promise<void>
}) {
  const [leftScores, setLeftScores] = useState(initialScore)
  const [rightScores, setRightScores] = useState(initialScore)
  const [winner, setWinner] = useState<Winner | ''>('')
  const [note, setNote] = useState('')
  const isRoundTwo = run.evaluation_round === 2

  // 저장에 성공하면 다음 쌍으로 넘어가며 RunPage가 key로 이 컴포넌트를 새로 마운트하므로
  // 입력값 초기화를 따로 하지 않습니다. 실패하면 입력을 그대로 두고 오류만 표시합니다.
  const handleVote = () => {
    if (!winner) return
    void onSubmit({ pairId: pair.pair_id, winner, leftScores, rightScores, note })
      .catch(() => undefined)
  }

  return (
    <main className="evaluate-shell">
      <header className="eval-header">
        <div className="brand">
          <span>G</span><b>GORDI</b> / {isRoundTwo ? 'ROUND 02 · BLIND TEST' : 'BLIND TEST'}
        </div>
        <div className="progress-copy"><b>{padRank(completed + 1)}</b> / {padRank(run.pair_count)}</div>
        <div className="identity"><i /> {evaluatorId}</div>
      </header>
      <div className="thin-progress"><i style={{ width: `${(completed / run.pair_count) * 100}%` }} /></div>

      <section className="eval-context">
        <div>
          <p className="kicker">
            {isRoundTwo ? 'ROUND 02 · ' : ''}{run.scenario_name}
          </p>
          <h1>어느 쪽이 더 설득력 있나요?</h1>
        </div>
        <div className="reference-tray">
          <span>REFERENCE</span>
          <HoverZoomImage src={mediaUrl(run.references.avatar_url)} alt="평가 기준 아바타" />
          {run.references.garments.map((item) => (
            <HoverZoomImage
              src={mediaUrl(item.image_url)}
              alt={item.caption}
              key={item.image_url}
            />
          ))}
        </div>
      </section>

      {isRoundTwo && <Round2FitBrief run={run} />}

      <section className="compare-grid">
        <article className={`candidate-card ${winner === 'LEFT' ? 'selected' : ''}`}>
          <div className="candidate-label"><span>A</span> 시안 A <small>MODEL HIDDEN</small></div>
          <HoverZoomImage src={mediaUrl(pair.left.image_url)} alt="블라인드 후보 A" />
        </article>
        <div className="versus">VS</div>
        <article className={`candidate-card ${winner === 'RIGHT' ? 'selected' : ''}`}>
          <div className="candidate-label"><span>B</span> 시안 B <small>MODEL HIDDEN</small></div>
          <HoverZoomImage src={mediaUrl(pair.right.image_url)} alt="블라인드 후보 B" />
        </article>
      </section>

      <section className="evaluation-form">
        <div className="preference-row">
          <p>더 나은 결과</p>
          <div>
            <button className={winner === 'LEFT' ? 'active' : ''} onClick={() => setWinner('LEFT')}>A가 우수</button>
            <button className={winner === 'TIE' ? 'active' : ''} onClick={() => setWinner('TIE')}>비슷함</button>
            <button className={winner === 'NEITHER' ? 'active' : ''} onClick={() => setWinner('NEITHER')}>둘 다 부적합</button>
            <button className={winner === 'RIGHT' ? 'active' : ''} onClick={() => setWinner('RIGHT')}>B가 우수</button>
          </div>
        </div>
        <div className="score-grid">
          <ScorePanel title="시안 A" value={leftScores} onChange={setLeftScores} />
          <ScorePanel title="시안 B" value={rightScores} onChange={setRightScores} />
        </div>
        <div className="vote-footer">
          <label className="field grow"><span>메모 · 선택</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="눈에 띈 장점이나 실패 패턴" /></label>
          <button className="primary-button" disabled={!winner || busy} onClick={handleVote}>평가 저장 &amp; 다음 <span>→</span></button>
        </div>
        {error && <div className="error-banner">{error}</div>}
      </section>
    </main>
  )
}
