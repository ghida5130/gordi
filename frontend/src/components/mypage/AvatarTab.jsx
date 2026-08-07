import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";

import { getMyAvatar } from "@/api/users";
import ActionButton from "@/components/common/ActionButton";
import AvatarSetupPrompt from "@/components/common/AvatarSetupPrompt";
import StatusPanel from "@/components/common/StatusPanel";
import SurfaceCard from "@/components/common/SurfaceCard";
import { getApiErrorMessage } from "@/utils/apiError";

const BODY_TYPE_LABELS = {
    SLIM: "상체형",
    STANDARD: "밸런스",
    MUSCULAR: "하체형",
    SOLID: "탄탄형",
};

export default function AvatarTab() {
    const navigate = useNavigate();
    const avatarQuery = useQuery({ queryKey: ["myAvatar"], queryFn: getMyAvatar, retry: false, refetchOnMount: "always" });
    const avatar = avatarQuery.data?.data ?? avatarQuery.data;

    if (avatarQuery.isPending || avatarQuery.isFetching) {
        return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-3xl bg-slate-100" />;
    }

    if (avatarQuery.isError) {
        if (avatarQuery.error.response?.status === 404) {
            return <AvatarSetupPrompt />;
        }

        return <StatusPanel tone="danger" role="alert" className="mx-auto max-w-3xl">{getApiErrorMessage(avatarQuery.error, "아바타 정보를 불러오지 못했습니다.")}</StatusPanel>;
    }

    const gender = avatar.gender === "MALE"
        ? "남성"
        : avatar.gender === "FEMALE"
            ? "여성"
            : "미입력";
    const bodyType = BODY_TYPE_LABELS[avatar.bodyType] ?? avatar.bodyType;
    const height = avatar.height;
    const weight = avatar.weight;

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl"
        >
            <SurfaceCard as="div" className="grid overflow-hidden md:grid-cols-[300px_1fr]">
                <div className="relative flex min-h-96 items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#f5f3ff,#ecfdf5)] p-6">
                    <motion.img
                        src={avatar.imageUrl}
                        alt={`${bodyType} 아바타`}
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.08, duration: 0.4 }}
                        className="max-h-80 w-full object-contain"
                    />
                </div>
                <div className="flex flex-col justify-center p-8">
                    <h1 className="text-3xl font-black tracking-tight">{bodyType}</h1>
                    <p className="mt-2 text-sm text-slate-500">저장된 체형 정보가 추천과 가상 피팅에 사용됩니다.</p>
                    <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 rounded-2xl bg-slate-50 px-5 py-5 text-sm">
                        <dt className="text-slate-500">성별</dt><dd className="text-right font-bold">{gender}</dd>
                        <dt className="text-slate-500">키</dt><dd className="text-right font-bold">{height == null ? "미입력" : `${height}cm`}</dd>
                        <dt className="text-slate-500">몸무게</dt><dd className="text-right font-bold">{weight == null ? "미입력" : `${weight}kg`}</dd>
                    </dl>
                    <ActionButton onClick={() => navigate("/mypage/avatar/edit")} className="mt-7 w-full">아바타 수정하기 <span aria-hidden="true">→</span></ActionButton>
                </div>
            </SurfaceCard>
        </motion.section>
    );
}
