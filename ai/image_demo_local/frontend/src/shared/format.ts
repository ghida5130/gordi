export const formatMs = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value).toLocaleString()} ms`

export const formatCost = (value: number | null | undefined) =>
  value == null ? '—' : `$${value.toFixed(4)}`

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export const padRank = (value: number) => String(value).padStart(2, '0')
