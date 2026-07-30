import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { login, logout } from "@/api/auth";
import { getPosts } from "@/api/posts";
import PageContainer from "@/components/common/PageContainer";
import { useUserStore } from "@/stores/useUserStore";
import { getApiErrorMessage } from "@/utils/apiError";
import { removeAccessToken, setAccessToken } from "@/utils/tokenStorage";

const initialForm = {
  email: "",
  password: "",
};

const postQueryParams = {
  page: 1,
  size: 5,
};

// 인증과 일반 API 요청 흐름을 확인하는 학습용 화면
function ApiExamplePage() {
  const [form, setForm] = useState(initialForm);
  const queryClient = useQueryClient();
  const { email, nickname, profileImageUrl, isLogin, setUser, clearUser } =
    useUserStore();

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: ({ accessToken, user }) => {
      // 토큰 저장 후 화면에 필요한 사용자 정보만 전역 상태에 반영
      setAccessToken(accessToken);
      setUser(user);
      setForm(initialForm);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      // 서버 요청 성공 여부와 관계없이 로컬 인증 정보 정리
      removeAccessToken();
      clearUser();
      queryClient.clear();
    },
  });

  const postsQuery = useQuery({
    queryKey: ["posts", postQueryParams],
    queryFn: () => getPosts(postQueryParams),
    // 버튼을 눌렀을 때만 일반 조회 요청 실행
    enabled: false,
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleLogin = (event) => {
    event.preventDefault();
    loginMutation.mutate(form);
  };

  return (
    <PageContainer className="py-12">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-brand-600">API 요청 예제</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          로그인과 일반 조회 요청 흐름
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          아래 요청 주소와 응답 형태는 예시입니다. 실제 백엔드 API 명세에 맞게
          API 함수만 수정하면 페이지의 요청 흐름은 그대로 사용할 수 있습니다.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">인증 요청</h2>
              <p className="mt-1 text-sm text-slate-500">
                POST /auth/login · POST /auth/logout
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isLogin
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isLogin ? "로그인 상태" : "로그아웃 상태"}
            </span>
          </div>

          {isLogin ? (
            <div className="mt-6">
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={`${nickname ?? "사용자"} 프로필`}
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-600">
                    {(nickname ?? email ?? "U").slice(0, 1)}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{nickname ?? "닉네임 없음"}</p>
                  <p className="text-sm text-slate-500">{email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
              </button>

              {logoutMutation.isError && (
                <p className="mt-3 text-sm text-amber-700">
                  서버 로그아웃 요청은 실패했지만 로컬 인증 정보는 삭제했습니다.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">이메일</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="user@example.com"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">비밀번호</span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="비밀번호 입력"
                />
              </label>

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginMutation.isPending ? "로그인 중..." : "로그인"}
              </button>

              {loginMutation.isError && (
                <p className="text-sm text-red-600">
                  {getApiErrorMessage(
                    loginMutation.error,
                    "로그인에 실패했습니다.",
                  )}
                </p>
              )}
            </form>
          )}

          <div className="mt-6 rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
            <p className="font-semibold text-white">로그인 응답 예시</p>
            <pre className="mt-2 overflow-x-auto">
              {`{
  "accessToken": "access-token",
  "user": {
    "email": "user@example.com",
    "nickname": "사용자",
    "profileImageUrl": "https://..."
  }
}`}
            </pre>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">일반 조회 요청</h2>
          <p className="mt-1 text-sm text-slate-500">
            GET /posts?page=1&amp;size=5
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            공개 요청용 <code>publicApi</code>를 사용하므로 액세스 토큰은
            포함되지 않습니다. TanStack Query가 로딩·오류·응답 상태를
            관리합니다.
          </p>

          <button
            type="button"
            onClick={() => postsQuery.refetch()}
            disabled={postsQuery.isFetching}
            className="mt-5 rounded-lg border bg-white px-4 py-2.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {postsQuery.isFetching ? "게시글 요청 중..." : "게시글 조회"}
          </button>

          {postsQuery.isError && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {getApiErrorMessage(
                postsQuery.error,
                "게시글 조회에 실패했습니다.",
              )}
            </p>
          )}

          {postsQuery.data !== undefined && (
            <div className="mt-5">
              <p className="text-sm font-semibold">서버 응답</p>
              <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                {JSON.stringify(postsQuery.data, null, 2)}
              </pre>
            </div>
          )}

          <ol className="mt-6 space-y-3 text-sm leading-6 text-slate-600">
            <li>1. Query Key에 페이지 조건을 넣어 캐시 구분</li>
            <li>2. API 함수에서 공개 Axios 인스턴스로 요청</li>
            <li>3. 공통 REST 함수가 응답 본문만 반환</li>
            <li>4. Query가 결과와 오류를 캐시에 저장</li>
          </ol>
        </section>
      </div>
    </PageContainer>
  );
}

export default ApiExamplePage;
