/**
 * 화면 전환은 4개 라우트로만 이루어집니다.
 *   (없음)                 → 1차 입력
 *   ?dashboard=1           → 1차 결과 대시보드
 *   ?round=2               → 2차 입력
 *   ?round=2&dashboard=1   → 2차 결과 대시보드
 *   ?run=<id>              → 블라인드 평가 / 결과 (1·2차 공용, 라운드는 run 응답으로 판별)
 */
export type AppRoute =
  | { name: 'round1-setup' }
  | { name: 'round1-dashboard' }
  | { name: 'round2-setup' }
  | { name: 'round2-dashboard' }
  | { name: 'run'; runId: string }

export type EvaluationRoundNumber = 1 | 2

export function parseRoute(search: string = window.location.search): AppRoute {
  const params = new URLSearchParams(search)
  const isRound2 = params.get('round') === '2'
  if (params.get('dashboard') === '1') {
    return { name: isRound2 ? 'round2-dashboard' : 'round1-dashboard' }
  }
  const runId = params.get('run')
  if (runId) return { name: 'run', runId }
  if (isRound2) return { name: 'round2-setup' }
  return { name: 'round1-setup' }
}

export function routeSearch(route: AppRoute): string {
  switch (route.name) {
    case 'round1-dashboard':
      return '?dashboard=1'
    case 'round2-setup':
      return '?round=2'
    case 'round2-dashboard':
      return '?round=2&dashboard=1'
    case 'run':
      return `?run=${encodeURIComponent(route.runId)}`
    default:
      return ''
  }
}

/** 앵커 태그용 href. 쿼리가 없는 라우트는 base 경로로 되돌립니다. */
export function routeHref(route: AppRoute): string {
  return routeSearch(route) || import.meta.env.BASE_URL
}

export function dashboardRoute(round: EvaluationRoundNumber): AppRoute {
  return { name: round === 2 ? 'round2-dashboard' : 'round1-dashboard' }
}

export function setupRoute(round: EvaluationRoundNumber): AppRoute {
  return { name: round === 2 ? 'round2-setup' : 'round1-setup' }
}

/**
 * 히스토리를 갱신하고 popstate를 직접 발생시켜 AppRouter가 다시 렌더링하게 합니다.
 * pushState/replaceState는 popstate를 발생시키지 않기 때문입니다.
 */
export function navigate(route: AppRoute, options: { replace?: boolean } = {}): void {
  const url = routeSearch(route) || window.location.pathname
  if (options.replace) {
    window.history.replaceState(null, '', url)
  } else {
    window.history.pushState(null, '', url)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
}
