import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { login, startKakaoLogin } from "@/api/auth";
import { getMyInfo } from "@/api/users";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useUserStore } from "@/stores/useUserStore";
import { useToast } from "@/hooks/useToast";
// 💡 토큰 저장 함수 불러오기
import { setAccessToken } from "@/utils/tokenStorage";

function getRedirectPath(from) {
    if (
        typeof from !== "string" ||
        !from.startsWith("/") ||
        from.startsWith("//") ||
        from === "/login"
    ) {
        return "/";
    }

    return from;
}

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    const [searchParams] = useSearchParams();
    const setUser = useUserStore((state) => state.setUser);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // ⭐️ 최신 로그인 API 명세서 반영
    const { mutate, isPending } = useMutation({
        mutationFn: login,
        onSuccess: (response, variables) => {
            // 1. 응답 데이터에서 Access Token 추출
            const accessToken = response.data?.data?.accessToken || response.data?.accessToken || response.accessToken;

            // 2. 토큰을 스토리지에 저장
            if (!accessToken) {
                toast.error("로그인 인증 정보를 확인하지 못했습니다. 다시 시도해주세요.");
                return;
            }

            setAccessToken(accessToken);
            setUser({
                email: variables.email,
                nickname: null,
                profileImageUrl: null,
            });

            toast.success("로그인에 성공했습니다.");

            // - 로그인 성공 즉시 이전 보호 경로 또는 메인으로 이동
            navigate(getRedirectPath(location.state?.from), { replace: true });

            getMyInfo()
              .then((myInfoResponse) => {
                const user = myInfoResponse.data;
                setUser({
                    email: user.email,
                    nickname: user.nickname,
                    profileImageUrl: user.avatar?.imageUrl,
                });
              })
              .catch((error) => {
                console.error("사용자 정보 조회 실패:", error);
              });
        },
        onError: (error) => {
            // 4. 상태 코드별 맞춤 에러 메시지 띄우기
            const status = error.response?.status;

            if (status === 401) {
                toast.error("이메일 또는 비밀번호가 일치하지 않습니다.");
            } else if (status === 400) {
                toast.warning("입력하신 정보의 형식이 올바르지 않습니다.");
            } else {
                console.error("로그인 실패:", error);
                toast.error("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !password) {
            toast.warning("이메일과 비밀번호를 모두 입력해주세요.");
            return;
        }

        // 백엔드 명세서에 맞게 email, password 전송
        mutate({ email, password });
    };

    return (
        <div className="relative flex min-h-[calc(100vh-6rem)] min-w-[1100px] items-center justify-center overflow-hidden px-12 py-16">

            <motion.main
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-[610px] overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
            >
                <section className="flex flex-col justify-center px-14 py-12">
                    <div className="mb-8">
                        <h2 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950">다시 만나서 반가워요</h2>
                        <p className="mt-2 text-sm text-slate-500">로그인하고 이어서 의상을 골라보세요.</p>
                    </div>

                    <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
                        <div>
                            <label htmlFor="login-email" className="mb-2 block text-xs font-semibold text-slate-600">이메일</label>
                            <input
                                id="login-email"
                                type="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                inputMode="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="user@example.com"
                                required
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                            />
                        </div>

                        <div>
                            <label htmlFor="login-password" className="mb-2 block text-xs font-semibold text-slate-600">비밀번호</label>
                            <input
                                id="login-password"
                                type="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                placeholder="••••••••"
                                required
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                            />
                        </div>

                        <motion.button
                            type="submit"
                            disabled={isPending}
                            whileHover={isPending ? undefined : { y: -2 }}
                            whileTap={isPending ? undefined : { scale: 0.985 }}
                            className="mt-2 w-full rounded-2xl bg-[#253129] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,49,41,0.2)] transition-colors hover:bg-[#344239] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        >
                            {isPending ? "로그인 중..." : "로그인"}
                        </motion.button>

                    </form>

                    <div className="my-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-[11px] font-medium text-slate-400">또는</span>
                        <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    {searchParams.get("error") === "oauth" && (
                        <p role="alert" className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                            카카오 로그인에 실패했습니다. 다시 시도해 주세요.
                        </p>
                    )}

                    <motion.button
                        type="button"
                        onClick={startKakaoLogin}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 py-3.5 text-sm font-bold text-[#191919] shadow-[0_10px_24px_rgba(95,83,0,0.12)] transition-colors hover:bg-[#F5DC00]"
                    >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.85 5.34 4.64 6.76l-1.18 4.37c-.1.38.33.68.66.46l5.16-3.43c.24.02.48.03.72.03 5.52 0 10-3.58 10-8.19S17.52 3 12 3Z" />
                        </svg>
                        카카오로 시작하기
                    </motion.button>

                    <div className="pt-7 text-center text-sm text-slate-500">
                        계정이 없으신가요?{" "}
                        <Link to="/signup/email" className="ml-1 font-bold text-emerald-700 transition-colors hover:text-emerald-900">
                            이메일로 회원가입
                        </Link>
                    </div>
                </section>
            </motion.main>
        </div>
    );
}
