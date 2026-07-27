import PageContainer from '@/components/common/PageContainer'

const STACK_ITEMS = [
  {
    title: 'React Router',
    description: '중첩 라우트와 공통 레이아웃 구성',
  },
  {
    title: 'TanStack Query',
    description: '서버 상태 캐싱과 요청 상태 관리',
  },
  {
    title: 'Zustand',
    description: '작고 명확한 클라이언트 상태 관리',
  },
  {
    title: 'Axios',
    description: '일관된 REST API 요청 처리',
  },
]

// 초기 설정 완료 여부를 확인할 수 있는 기본 화면
function HomePage() {
  return (
    <PageContainer className="py-16 sm:py-24">
      <section className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold tracking-wider text-brand-600 uppercase">
          Frontend Starter
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          개발을 시작할 준비가 되었습니다.
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          라우팅, 서버 상태, 전역 상태, API 요청, 스타일 시스템의 기본 구성을
          연결했습니다.
        </p>
      </section>

      <section
        aria-label="설정된 기술"
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {STACK_ITEMS.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {item.description}
            </p>
          </article>
        ))}
      </section>
    </PageContainer>
  )
}

export default HomePage
