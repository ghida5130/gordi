import { startKakaoLogin } from "@/api/auth";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";

export default function SignupSelectPage() {
    const navigate = useNavigate();

    return (
        <div className="relative flex min-h-[calc(100vh-6rem)] min-w-[1100px] items-center justify-center overflow-hidden px-12 py-16">

            <motion.main
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative grid w-[980px] grid-cols-[370px_1fr] overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
            >
                <section className="relative flex min-h-[600px] flex-col overflow-hidden bg-[#253129] p-10 text-white">
                    <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full border border-white/10" />
                    <div className="absolute -left-6 -top-12 h-36 w-36 rounded-full bg-white/5" />

                    <h1 className="relative text-[34px] font-semibold leading-[1.2] tracking-[-0.04em]">
                        나다운 옷을 찾는
                        <br />가장 즐거운 방법.
                    </h1>
                    <p className="relative mt-4 text-sm leading-6 text-white/58">
                        아바타로 먼저 입어보고,
                        <br />친구와 함께 취향을 완성해요.
                    </p>

                    <div className="relative mt-auto space-y-2.5">
                        {[
                            ["01", "나만의 체형 설정", "bg-emerald-200"],
                            ["02", "AI 의상 추천", "bg-violet-200"],
                            ["03", "함께 만드는 티어", "bg-amber-200"],
                        ].map(([number, label, color], index) => (
                            <motion.div
                                key={number}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.22 + index * 0.08, duration: 0.42 }}
                                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3"
                            >
                                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color} text-[11px] font-black text-[#253129]`}>{number}</span>
                                <span className="text-xs font-semibold text-white/75">{label}</span>
                            </motion.div>
                        ))}
                    </div>
                </section>

                <section className="flex flex-col justify-center px-14 py-12">
                    <div>
                        <h2 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950">gordi 회원가입</h2>
                        <p className="mt-2 text-sm text-slate-500">편한 방법으로 시작해 보세요.</p>
                    </div>

                    <div className="mt-9 space-y-3">
                        {/* 1. 카카오톡 회원가입 (OAuth 연동) */}
                        <motion.button
                            type="button"
                            onClick={startKakaoLogin}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.985 }}
                            className="flex w-full items-center justify-between rounded-2xl bg-[#FEE500] px-5 py-4 text-sm font-bold text-[#191919] shadow-[0_10px_24px_rgba(95,83,0,0.12)] transition-colors hover:bg-[#F5DC00]"
                        >
                            <span className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                                        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.85 5.34 4.64 6.76l-1.18 4.37c-.1.38.33.68.66.46l5.16-3.43c.24.02.48.03.72.03 5.52 0 10-3.58 10-8.19S17.52 3 12 3Z" />
                                    </svg>
                                </span>
                                카카오톡으로 시작하기
                            </span>
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </motion.button>

                        {/* 2. 일반 이메일 회원가입 */}
                        <motion.button
                            type="button"
                            onClick={() => navigate("/signup/email")}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.985 }}
                            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                        >
                            <span className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                </span>
                                이메일로 시작하기
                            </span>
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </motion.button>
                    </div>

                    <div className="mt-9 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
                        이미 계정이 있으신가요?
                        <Link to="/login" className="ml-1.5 font-bold text-emerald-700 transition-colors hover:text-emerald-900">
                            로그인
                        </Link>
                    </div>
                </section>
            </motion.main>
        </div>
    );
}
