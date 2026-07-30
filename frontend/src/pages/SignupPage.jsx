import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { signup } from "@/api/auth";
import PageContainer from "@/components/common/PageContainer";
import { getApiErrorMessage } from "@/utils/apiError";

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    nickname: "",
  });

  const signupMutation = useMutation({
    mutationFn: signup,
    onSuccess: () => {
      navigate("/", {
        replace: true,
        state: { signupCompleted: true },
      });
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
    signupMutation.mutate(form);
  };

  return (
    <main className="flex min-h-screen items-center bg-slate-100 py-12">
      <PageContainer>
        <section className="mx-auto max-w-md rounded-3xl border bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9">
          <p className="text-sm font-semibold text-brand-600">회원가입</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            새 계정 만들기
          </h1>

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
                className="mt-2 w-full rounded-xl border px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
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
                autoComplete="new-password"
                placeholder="비밀번호를 입력해 주세요"
                className="mt-2 w-full rounded-xl border px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">닉네임</span>
              <input
                type="text"
                name="nickname"
                value={form.nickname}
                onChange={handleChange}
                required
                autoComplete="nickname"
                placeholder="gordi"
                className="mt-2 w-full rounded-xl border px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
              />
            </label>

            {signupMutation.isError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {getApiErrorMessage(
                  signupMutation.error,
                  "회원가입에 실패했습니다.",
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={signupMutation.isPending}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signupMutation.isPending ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            이미 계정이 있나요?{" "}
            <Link to="/" className="font-semibold text-brand-600 hover:underline">
              로그인
            </Link>
          </p>
        </section>
      </PageContainer>
    </main>
  );
}

export default SignupPage;
