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
        onSuccess: async (response) => {
            // 1. 응답 데이터에서 Access Token 추출
            const accessToken = response.data?.data?.accessToken || response.data?.accessToken;

            // 2. 토큰을 스토리지에 저장
            if (accessToken) {
                setAccessToken(accessToken);
            }

            try {
                const myInfoResponse = await getMyInfo();
                const user = myInfoResponse.data;

                setUser({
                    email: user.email,
                    nickname: user.nickname,
                    profileImageUrl: user.avatar?.imageUrl,
                });

                toast.success("로그인에 성공했습니다.");

                // 3. 메인(홈) 화면으로 이동
                navigate(location.state?.from ?? "/", { replace: true });
            } catch (error) {
                console.error("사용자 정보 조회 실패:", error);
                toast.error("사용자 정보를 불러오지 못했습니다. 다시 시도해주세요.");
            }
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

    const handleTemporaryLogin = () => {
        setAccessToken("temporary-access-token");
        setUser({
            email: "test@gordi.local",
            nickname: "테스트 사용자",
            profileImageUrl: null,
        });
        toast.success("임시 계정으로 로그인했습니다.");
        navigate(location.state?.from ?? "/", { replace: true });
    };

    return (
        <div className="relative flex min-h-[calc(100vh-6rem)] min-w-[1100px] items-center justify-center overflow-hidden px-12 py-16">

            <motion.main
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative grid w-[980px] grid-cols-[370px_1fr] overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
            >
                <section className="relative flex min-h-[650px] flex-col overflow-hidden bg-[#253129] p-10 text-white">
                    <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full border border-white/10" />
                    <div className="absolute -right-12 -top-8 h-40 w-40 rounded-full bg-white/5" />

                    <div className="relative">
                        <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em]">
                            혼자 고르기 어려울 땐,
                            <br />함께 골라봐요.
                        </h1>
                        <p className="mt-4 text-sm leading-6 text-white/58">
                            나만의 체형과 취향을 담고,
                            <br />친구들과 티어를 나누어보세요.
                        </p>
                    </div>

                    <div className="relative mt-auto rounded-[24px] border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
                        <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                            <span>Today&apos;s tier</span>
                            <span>3 items</span>
                        </div>
                        <div className="space-y-2">
                            {[
                                ["S", "bg-[#f8dfa2]", "오늘의 베스트"],
                                ["A", "bg-[#cfe3d3]", "다시 입고 싶은 옷"],
                                ["B", "bg-[#dcd8ed]", "고민 중인 옷"],
                            ].map(([tier, color, label], index) => (
                                <motion.div
                                    key={tier}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.24 + index * 0.08, duration: 0.4 }}
                                    className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-2"
                                >
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color} text-xs font-black text-[#253129]`}>{tier}</span>
                                    <span className="text-xs font-medium text-white/72">{label}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="flex flex-col justify-center px-14 py-12">
                    <div className="mb-8">
                        <h2 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950">다시 만나서 반가워요</h2>
                        <p className="mt-2 text-sm text-slate-500">로그인하고 이어서 의상을 골라보세요.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-600">이메일</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-600">비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
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

                        <motion.button
                            type="button"
                            onClick={handleTemporaryLogin}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.985 }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                        >
                            임시 로그인
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
                        카카오로 로그인
                    </motion.button>

                    <div className="pt-7 text-center text-sm text-slate-500">
                        계정이 없으신가요?{" "}
                        <Link to="/signup" className="ml-1 font-bold text-emerald-700 transition-colors hover:text-emerald-900">
                            회원가입
                        </Link>
                    </div>
                </section>
            </motion.main>
        </div>
    );
}
