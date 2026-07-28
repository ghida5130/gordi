import { QueryClient } from '@tanstack/react-query'

// 애플리케이션 전체에 적용할 서버 상태 기본 정책
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
