import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export default function SignupCompletePage() {
    const navigate = useNavigate();

    return (
        <main className="relative flex min-h-[calc(100vh-6rem)] min-w-[1000px] items-center justify-center overflow-hidden px-12 py-14">

            <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-[540px] overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
            >
                <div className="flex flex-col justify-center px-12 py-12">
                    <motion.span
                        initial={{ scale: 0.72, opacity: 0, rotate: -8 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ delay: 0.18, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        className="mb-7 flex h-20 w-20 items-center justify-center rounded-[26px] bg-emerald-100 text-[#253129] shadow-[0_14px_34px_rgba(37,49,41,0.12)]"
                    >
                        <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m5 12 4 4L19 6" />
                        </svg>
                    </motion.span>
                    <h1 className="text-[30px] font-semibold leading-[1.25] tracking-[-0.04em] text-slate-950">회원가입이<br />완료되었습니다</h1>
                    <p className="mt-4 text-sm leading-6 text-slate-500">로그인하면 체형을 설정하고<br />나에게 어울리는 의상을 추천받을 수 있어요.</p>

                    <div className="mt-8 space-y-3">
                        <motion.button
                            type="button"
                            onClick={() => navigate("/login", { replace: true })}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.985 }}
                            className="w-full rounded-2xl bg-[#253129] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,49,41,0.2)] transition-colors hover:bg-[#344239]"
                        >
                            로그인 하러가기
                        </motion.button>
                        <motion.button
                            type="button"
                            onClick={() => navigate("/", { replace: true })}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.985 }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                            메인페이지로
                        </motion.button>
                    </div>
                </div>
            </motion.section>
        </main>
    );
}
