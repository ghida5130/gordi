import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getAvatarTemplates } from "@/api/avatar";
import { updateMyAvatar } from "@/api/users";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";
import { getApiErrorMessage } from "@/utils/apiError";
import { getBodyInformation, setBodyInformation } from "@/utils/bodyInformationStorage";

const BODY_TYPE_LABELS = {
    SLIM: "상체형",
    STANDARD: "밸런스",
    MUSCULAR: "하체형",
    SOLID: "탄탄형",
};

const getAvatarId = (avatar) => avatar?.avatarId ?? avatar?.id;

function prioritizeAvatarTemplates(avatarList, weightId) {
    if (!weightId || avatarList.length <= 3) {
        return { orderedAvatars: avatarList, initialAvatarCount: avatarList.length };
    }

    let requestedRangeStart = 3;

    if (weightId === 1) requestedRangeStart = 0;
    if (weightId === 5) requestedRangeStart = Math.max(avatarList.length - 3, 0);

    const requestedRangeEnd = Math.min(requestedRangeStart + 3, avatarList.length);
    const requestedRangeAvatars = avatarList.slice(requestedRangeStart, requestedRangeEnd);
    const otherRangeAvatars = [
        ...avatarList.slice(0, requestedRangeStart),
        ...avatarList.slice(requestedRangeEnd),
    ];

    return {
        orderedAvatars: [...requestedRangeAvatars, ...otherRangeAvatars],
        initialAvatarCount: requestedRangeAvatars.length,
    };
}

function mapHeightToId(height) {
    if (!height) return 0;

    const value = Number(height);
    if (value < 150) return 1;
    if (value < 160) return 2;
    if (value < 170) return 3;
    if (value < 180) return 4;
    return 5;
}

function mapWeightToId(weight) {
    if (!weight) return 0;

    const value = Number(weight);
    if (value < 50) return 1;
    if (value < 60) return 2;
    if (value < 70) return 3;
    if (value < 80) return 4;
    return 5;
}

function AvatarOption({ avatar, selected, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(avatar)}
            aria-pressed={selected}
            className={`relative overflow-hidden rounded-lg border bg-white text-left transition-all ${selected ? "border-black shadow-md ring-2 ring-black" : "border-gray-200 hover:border-gray-400"}`}
        >
            <div className="relative flex aspect-[4/5] items-center justify-center bg-gray-50">
                {avatar.imageUrl ? (
                    <img src={avatar.imageUrl} alt={`${BODY_TYPE_LABELS[avatar.bodyType] ?? avatar.bodyType} 체형`} className="h-full w-full object-contain" />
                ) : (
                    <svg className="h-14 w-14 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <circle cx="12" cy="7" r="3" />
                        <path d="M7 21v-4a5 5 0 0 1 10 0v4M9 12l-2 5M15 12l2 5" />
                    </svg>
                )}
                {selected && (
                    <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black text-sm font-bold text-white shadow-sm" aria-hidden="true">✓</span>
                )}
            </div>
            <div className={`px-3 py-3 text-center text-sm font-bold transition-colors ${selected ? "bg-black text-white" : "text-gray-800"}`}>{BODY_TYPE_LABELS[avatar.bodyType] ?? avatar.bodyType}</div>
        </button>
    );
}

export default function AvatarSetupPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();
    const updateUser = useUserStore((state) => state.updateUser);
    const [step, setStep] = useState("information");
    const [gender, setGender] = useState(() => getBodyInformation()?.gender ?? "");
    const [height, setHeight] = useState(() => {
        const savedHeight = getBodyInformation()?.height;
        return savedHeight ? String(savedHeight) : "";
    });
    const [weight, setWeight] = useState(() => {
        const savedWeight = getBodyInformation()?.weight;
        return savedWeight ? String(savedWeight) : "";
    });
    const [avatars, setAvatars] = useState([]);
    const [initialAvatarCount, setInitialAvatarCount] = useState(0);
    const [showAdditionalAvatars, setShowAdditionalAvatars] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState(null);

    const avatarMutation = useMutation({
        mutationFn: updateMyAvatar,
        onSuccess: (_response, { avatarId, avatar: requestedAvatar }) => {
            const savedAvatar = requestedAvatar ?? avatars.find((avatar) => String(getAvatarId(avatar)) === String(avatarId));

            setBodyInformation({
                gender,
                height: height ? Number(height) : 0,
                weight: weight ? Number(weight) : 0,
            });
            updateUser({ profileImageUrl: savedAvatar?.imageUrl ?? null });

            queryClient.invalidateQueries({ queryKey: ["myAvatar"] });
            queryClient.invalidateQueries({ queryKey: ["myInfo"] });
            toast.success("아바타가 설정되었습니다.");
            navigate("/mypage", { replace: true, state: { activeTab: "avatar" } });
        },
        onError: (error) => {
            if (error.response?.status === 404) {
                toast.error("선택한 체형 프리셋을 찾을 수 없습니다. 다시 선택해 주세요.");
                return;
            }

            toast.error(getApiErrorMessage(error, "체형 설정을 저장하지 못했습니다. 다시 시도해 주세요."));
        },
    });

    const templateMutation = useMutation({
        mutationFn: getAvatarTemplates,
        onSuccess: (response, request) => {
            const avatarList = Array.isArray(response.data)
                ? response.data
                : response.data?.avatars ?? response.avatars ?? [];

            if (avatarList.length === 0) {
                toast.error("선택할 수 있는 체형을 찾지 못했습니다.");
                return;
            }

            if (!request.heightId && !request.weightId && avatarList.length === 1) {
                const avatarId = getAvatarId(avatarList[0]);

                if (avatarId == null) {
                    toast.error("아바타 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
                    return;
                }

                setAvatars(avatarList);
                avatarMutation.mutate({ avatarId, avatar: avatarList[0] });
                return;
            }

            const prioritizedTemplates = prioritizeAvatarTemplates(avatarList, request.weightId);

            setAvatars(prioritizedTemplates.orderedAvatars);
            setInitialAvatarCount(prioritizedTemplates.initialAvatarCount);
            setShowAdditionalAvatars(false);
            setSelectedAvatar(null);
            setStep("selection");
        },
        onError: () => {
            toast.error("체형 템플릿을 불러오지 못했습니다. 다시 시도해 주세요.");
        },
    });

    const handleHeightChange = (event) => {
        const nextHeight = event.target.value;
        setHeight(nextHeight);

        if (!nextHeight) setWeight("");
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (!gender) {
            toast.warning("성별을 선택해 주세요.");
            return;
        }

        if (height && (Number(height) < 100 || Number(height) > 220)) {
            toast.warning("키는 100cm에서 220cm 사이로 입력해 주세요.");
            return;
        }

        if (weight && (Number(weight) < 30 || Number(weight) > 200)) {
            toast.warning("몸무게는 30kg에서 200kg 사이로 입력해 주세요.");
            return;
        }

        templateMutation.mutate({
            gender,
            heightId: mapHeightToId(height),
            weightId: mapWeightToId(weight),
        });
    };

    const handleNext = () => {
        if (!selectedAvatar) return;

        const avatarId = getAvatarId(selectedAvatar);

        if (avatarId == null) {
            toast.error("선택한 아바타 정보를 확인하지 못했습니다. 다시 선택해 주세요.");
            return;
        }

        avatarMutation.mutate({ avatarId, avatar: selectedAvatar });
    };

    const visibleAvatars = showAdditionalAvatars ? avatars : avatars.slice(0, initialAvatarCount);
    const hasAdditionalAvatars = avatars.length > initialAvatarCount;

    return (
        <main className="min-h-[calc(100vh-4rem)] bg-gray-50 px-4 py-10">
            <section className="mx-auto w-full max-w-2xl rounded-lg border border-gray-100 bg-white p-8 shadow-sm">
                <div className="flex items-start justify-between border-b border-gray-100 pb-6">
                    <div>
                        <p className="text-sm font-bold text-gray-400">{step === "information" ? "1 / 2" : "2 / 2"}</p>
                        <h1 className="mt-2 text-2xl font-bold text-gray-950">체형 설정</h1>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">선택 정보는 건너뛸 수 있어요</span>
                </div>

                {step === "information" ? (
                    <form onSubmit={handleSubmit} className="mt-7 space-y-6">
                        <fieldset>
                            <legend className="text-sm font-bold text-gray-800">성별 <span className="text-red-500">*</span></legend>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                {[["MALE", "남성"], ["FEMALE", "여성"]].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setGender(value)}
                                        className={`rounded-lg border px-4 py-3 text-sm font-bold transition-colors ${gender === value ? "border-black bg-black text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <label className="text-sm font-bold text-gray-800">
                                키 <span className="font-medium text-gray-400">(선택)</span>
                                <span className="relative mt-2 block">
                                    <input
                                        type="number"
                                        min="100"
                                        max="220"
                                        value={height}
                                        onChange={handleHeightChange}
                                        placeholder="100~220"
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 pr-12 font-medium outline-none transition-colors focus:border-black"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-gray-400">cm</span>
                                </span>
                            </label>

                            <label className={`text-sm font-bold ${height ? "text-gray-800" : "text-gray-400"}`}>
                                몸무게 <span className="font-medium text-gray-400">(선택)</span>
                                <span className="relative mt-2 block">
                                    <input
                                        type="number"
                                        min="30"
                                        max="200"
                                        value={weight}
                                        onChange={(event) => setWeight(event.target.value)}
                                        disabled={!height}
                                        placeholder={height ? "30~200" : "키를 먼저 입력"}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 pr-12 font-medium outline-none transition-colors focus:border-black disabled:bg-gray-100 disabled:text-gray-400"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-gray-400">kg</span>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={templateMutation.isPending || avatarMutation.isPending}
                            className="w-full rounded-lg bg-black px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300"
                        >
                            {avatarMutation.isPending ? "아바타 저장 중..." : templateMutation.isPending ? "템플릿 생성 중..." : "체형 템플릿 생성하기"}
                        </button>
                    </form>
                ) : (
                    <div className="mt-7">
                        <div>
                            <h2 className="text-lg font-bold text-gray-950">체형 선택</h2>
                            <p className="mt-1 text-sm text-gray-500">생성된 체형 중 하나를 선택해 주세요.</p>
                        </div>
                        <div className="mt-5 grid grid-cols-3 gap-3">
                            {visibleAvatars.map((avatar, index) => (
                                <AvatarOption key={`${getAvatarId(avatar) ?? avatar.bodyType}-${index}`} avatar={avatar} selected={selectedAvatar === avatar} onSelect={setSelectedAvatar} />
                            ))}
                        </div>
                        {hasAdditionalAvatars && !showAdditionalAvatars && (
                            <button
                                type="button"
                                onClick={() => setShowAdditionalAvatars(true)}
                                className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-gray-500 hover:bg-gray-50"
                            >
                                체형 더 불러오기
                            </button>
                        )}
                        <div className="mt-7 flex gap-3">
                            <button type="button" onClick={() => setStep("information")} className="w-1/3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">이전</button>
                            <button type="button" onClick={handleNext} disabled={!selectedAvatar || avatarMutation.isPending} className="flex-1 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300">
                                {avatarMutation.isPending ? "저장 중..." : "아바타 저장하기"}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
