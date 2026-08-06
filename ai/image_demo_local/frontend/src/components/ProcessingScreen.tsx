import type { ReactNode } from 'react'

export default function ProcessingScreen({
  kicker,
  title,
  description,
  footnote,
}: {
  kicker: string
  title: ReactNode
  description: ReactNode
  footnote?: ReactNode
}) {
  return (
    <main className="processing-shell">
      <div className="orbit"><span /><span /><span /><span /></div>
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="processing-bar"><i /></div>
      {footnote && <small>{footnote}</small>}
    </main>
  )
}
