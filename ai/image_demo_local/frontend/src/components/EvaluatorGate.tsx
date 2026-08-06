export default function EvaluatorGate({
  value,
  error,
  onChange,
  onSubmit,
}: {
  value: string
  error?: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <main className="gate-shell">
      <div className="brand-mark">G</div>
      <p className="kicker">GORDI MODEL LAB</p>
      <h1>평가자를 확인할게요.</h1>
      <p>팀 집계를 위해 구분 가능한 이름을 입력하세요. 모델명은 공개 전까지 숨겨집니다.</p>
      <div className="gate-form">
        <input
          autoFocus
          placeholder="예: 효민"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
        />
        <button type="button" onClick={onSubmit}>입장하기</button>
      </div>
      {error && <div className="error-banner">{error}</div>}
    </main>
  )
}
