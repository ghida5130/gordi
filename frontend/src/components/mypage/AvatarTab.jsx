import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getMyAvatar } from "@/api/users";
import AvatarSetupPrompt from "@/components/common/AvatarSetupPrompt";
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
        return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-lg bg-slate-100" />;
    }

    if (avatarQuery.isError) {
        if (avatarQuery.error.response?.status === 404) {
            return <AvatarSetupPrompt />;
        }

        return <p className="mx-auto max-w-3xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{getApiErrorMessage(avatarQuery.error, "아바타 정보를 불러오지 못했습니다.")}</p>;
    }

    const gender = avatar.gender === "MALE" ? "남성" : "여성";
    const bodyType = BODY_TYPE_LABELS[avatar.bodyType] ?? avatar.bodyType;
    const height = avatar.height;
    const weight = avatar.weight;

    return (
        <section className="mx-auto max-w-3xl">
            <div className="grid overflow-hidden rounded-lg border border-slate-100 bg-white md:grid-cols-[280px_1fr]">
                <div className="flex min-h-96 items-center justify-center bg-slate-50 p-6">
                    <img src={avatar.imageUrl} alt={`${bodyType} 아바타`} className="max-h-80 w-full object-contain" />
                </div>
                <div className="flex flex-col justify-center p-8">
                    <p className="text-sm font-bold text-slate-400">내 아바타</p>
                    <h1 className="mt-2 text-2xl font-bold">{bodyType}</h1>
                    <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 border-y border-slate-100 py-6 text-sm">
                        <dt className="text-slate-400">성별</dt><dd className="font-bold">{gender}</dd>
                        <dt className="text-slate-400">키</dt><dd className="font-bold">{height == null ? "미입력" : `${height}cm`}</dd>
                        <dt className="text-slate-400">몸무게</dt><dd className="font-bold">{weight == null ? "미입력" : `${weight}kg`}</dd>
                    </dl>
                    <button type="button" onClick={() => navigate("/mypage/avatar/edit")} className="mt-7 w-full rounded-lg bg-black px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800">아바타 수정하기</button>
                </div>
            </div>
        </section>
    );
}
