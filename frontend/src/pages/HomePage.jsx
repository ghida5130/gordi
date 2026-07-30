import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { login } from "@/api/auth";
import PageContainer from "@/components/common/PageContainer";
import { getApiErrorMessage } from "@/utils/apiError";
import { setAccessToken } from "@/utils/tokenStorage";

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      setAccessToken(response.data.accessToken);
      navigate("/rooms", { replace: true });
    },
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    loginMutation.mutate(form);
  };

  const handleTemporaryLogin = () => {
    setAccessToken("temporary-access-token");
    navigate("/rooms/create");
  };

  return (
    <main className="flex min-h-screen items-center bg-slate-100 py-12">
      <PageContainer>
        <section className="mx-auto max-w-md rounded-3xl border bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9">
          <p className="text-sm font-semibold text-brand-600">임시 로그인</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            다시 만나서 반가워요
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            이메일과 비밀번호를 입력해 로그인해 주세요.
          </p>

          {location.state?.signupCompleted && (
            <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              회원가입이 완료되었습니다. 로그인해 주세요.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-medium">이메일</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="user@example.com"
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
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
                placeholder="비밀번호를 입력해 주세요"
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
              />
            </label>

            {loginMutation.isError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {getApiErrorMessage(
                  loginMutation.error,
                  "로그인에 실패했습니다.",
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleTemporaryLogin}
              className="mt-3 w-full rounded-xl border border-dashed border-brand-500 px-4 py-3 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
            >
              임시 로그인 후 방 생성 화면 보기
            </button>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            계정이 없나요?{" "}
            <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
              회원가입
            </Link>
          </p>
        </section>
      </PageContainer>
    </main>
  );
}

export default HomePage;
