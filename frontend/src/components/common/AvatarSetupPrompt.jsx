import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

import ActionButton from "@/components/common/ActionButton";
import SurfaceCard from "@/components/common/SurfaceCard";

export default function AvatarSetupPrompt() {
    const navigate = useNavigate();

    return (
        <SurfaceCard className="mx-auto flex w-full max-w-xl flex-col items-center px-8 py-14 text-center">
            <motion.span
                initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-emerald-50 text-violet-600 ring-1 ring-inset ring-violet-100"
            >
                <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="7" r="3" />
                    <path d="M7 21v-4a5 5 0 0 1 10 0v4M9 12l-2 5M15 12l2 5" />
                </svg>
            </motion.span>
            <h1 className="mt-6 text-2xl font-black text-slate-950">나만의 아바타를 만들어 보세요</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">체형을 반영한 아바타로 맞춤 추천과 가상 피팅을 시작할 수 있어요.</p>
            <ActionButton onClick={() => navigate("/mypage/avatar/edit")} className="mt-7">
                체형 설정하기
                <span aria-hidden="true">→</span>
            </ActionButton>
        </SurfaceCard>
    );
}
