import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";

import { getAvatarTemplates } from "@/api/avatar";
import { getMyAvatar, updateMyAvatar } from "@/api/users";
import { useToast } from "@/hooks/useToast";
import { getApiErrorMessage } from "@/utils/apiError";

const BODY_TYPE_LABELS = {
    SLIM: "상체형",
    STANDARD: "밸런스",
    MUSCULAR: "하체형",
    SOLID: "탄탄형",
};

const getAvatarId = (avatar) => avatar?.avatarId ?? avatar?.id;

function groupAvatarTemplatesByWeight(avatarList, weightId) {
    const referenceWeightId = Number(weightId);

    return avatarList.reduce(
        (groups, avatar) => {
            const avatarWeightId = Number(avatar.weightId);

            if (avatarWeightId === referenceWeightId) groups.reference.push(avatar);
            if (avatarWeightId < referenceWeightId) groups.lower.push(avatar);
            if (avatarWeightId > referenceWeightId) groups.higher.push(avatar);

            return groups;
        },
        { lower: [], reference: [], higher: [] },
    );
}

function prioritizeAvatarTemplates(avatarList, weightId) {
    if (!weightId || avatarList.length <= 3) {
        return { orderedAvatars: avatarList, initialAvatarCount: avatarList.length };
    }

    const groups = groupAvatarTemplatesByWeight(avatarList, weightId);

    if (groups.reference.length === 0) {
        return { orderedAvatars: avatarList, initialAvatarCount: Math.min(3, avatarList.length) };
    }

    return {
        orderedAvatars: [...groups.reference, ...groups.lower, ...groups.higher],
        initialAvatarCount: groups.reference.length,
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
            className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition-all duration-300 ${selected ? "border-violet-500 shadow-[0_14px_32px_rgba(124,58,237,0.16)] ring-2 ring-violet-200" : "border-gray-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg"}`}
        >
            <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#f8fafc,#f5f3ff)]">
                {avatar.imageUrl ? (
                    <img src={avatar.imageUrl} alt={`${BODY_TYPE_LABELS[avatar.bodyType] ?? avatar.bodyType} 체형`} className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.025]" />
                ) : (
                    <svg className="h-14 w-14 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <circle cx="12" cy="7" r="3" />
                        <path d="M7 21v-4a5 5 0 0 1 10 0v4M9 12l-2 5M15 12l2 5" />
                    </svg>
                )}
                {selected && (
                    <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white shadow-sm" aria-hidden="true">✓</span>
                )}
            </div>
            <div className={`px-3 py-3 text-center text-sm font-bold transition-colors ${selected ? "bg-violet-600 text-white" : "text-gray-800"}`}>{BODY_TYPE_LABELS[avatar.bodyType] ?? avatar.bodyType}</div>
        </button>
    );
}

export default function AvatarSetupPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();
    const hasInitializedInformationRef = useRef(false);
    const [step, setStep] = useState("information");
    const [gender, setGender] = useState("");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [avatars, setAvatars] = useState([]);
    const [initialAvatarCount, setInitialAvatarCount] = useState(0);
    const [showAdditionalAvatars, setShowAdditionalAvatars] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState(null);
    const avatarQuery = useQuery({
        queryKey: ["myAvatar"],
        queryFn: getMyAvatar,
        retry: false,
        refetchOnMount: "always",
    });

    useEffect(() => {
        if (
            hasInitializedInformationRef.current ||
            !avatarQuery.isSuccess ||
            avatarQuery.isFetching
        ) {
            return;
        }

        const savedAvatar = avatarQuery.data?.data ?? avatarQuery.data;

        setGender(savedAvatar?.gender ?? "");
        setHeight(savedAvatar?.height == null ? "" : String(savedAvatar.height));
        setWeight(savedAvatar?.weight == null ? "" : String(savedAvatar.weight));
        hasInitializedInformationRef.current = true;
    }, [avatarQuery.data, avatarQuery.isFetching, avatarQuery.isSuccess]);

    const avatarMutation = useMutation({
        mutationFn: updateMyAvatar,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["myAvatar"] });
            queryClient.invalidateQueries({ queryKey: ["myInfo"] });
            toast.success("아바타가 설정되었습니다.");
            navigate("/mypage", { replace: true, state: { activeTab: "profile" } });
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
                avatarMutation.mutate({
                    avatarId,
                    avatar: avatarList[0],
                    height: height ? Number(height) : null,
                    weight: weight ? Number(weight) : null,
                });
                return;
            }

            const prioritizedTemplates = prioritizeAvatarTemplates(avatarList, request.weightId);
            const initialAvatars = prioritizedTemplates.orderedAvatars.slice(
                0,
                prioritizedTemplates.initialAvatarCount,
            );
            const defaultAvatar = initialAvatars.find(
                (avatar) => avatar.bodyType === "STANDARD",
            ) ?? null;

            setAvatars(prioritizedTemplates.orderedAvatars);
            setInitialAvatarCount(prioritizedTemplates.initialAvatarCount);
            setShowAdditionalAvatars(false);
            setSelectedAvatar(defaultAvatar);
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

        avatarMutation.mutate({
            avatarId,
            avatar: selectedAvatar,
            height: height ? Number(height) : null,
            weight: weight ? Number(weight) : null,
        });
    };

    if (avatarQuery.isPending || avatarQuery.isFetching) {
        return (
            <main className="min-h-[calc(100vh-6rem)] px-4 py-10">
                <div className="mx-auto h-[520px] w-full max-w-2xl animate-pulse rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]" />
            </main>
        );
    }

    if (avatarQuery.isError && avatarQuery.error.response?.status !== 404) {
        return (
            <main className="min-h-[calc(100vh-6rem)] px-4 py-10">
                <section className="mx-auto w-full max-w-2xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    <p className="text-sm text-red-700">
                        {getApiErrorMessage(avatarQuery.error, "저장된 체형 정보를 불러오지 못했습니다.")}
                    </p>
                    <button
                        type="button"
                        onClick={() => avatarQuery.refetch()}
                        className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-violet-600"
                    >
                        다시 시도
                    </button>
                </section>
            </main>
        );
    }

    const visibleAvatars = showAdditionalAvatars ? avatars : avatars.slice(0, initialAvatarCount);
    const hasAdditionalAvatars = avatars.length > initialAvatarCount;
    const requestedWeightId = mapWeightToId(weight);
    const avatarWeightGroups = groupAvatarTemplatesByWeight(avatars, requestedWeightId);
    const hasWeightGroups = requestedWeightId > 0 && avatarWeightGroups.reference.length > 0;
    const avatarSections = hasWeightGroups
        ? [
            ...(showAdditionalAvatars && avatarWeightGroups.lower.length > 0
                ? [{
                    key: "lower",
                    label: "기준보다 작은 체형",
                    description: "입력한 몸무게 기준보다 한 단계 작은 체형이에요.",
                    labelClassName: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
                    avatars: avatarWeightGroups.lower,
                }]
                : []),
            {
                key: "reference",
                label: "내 기준 체형",
                description: "입력한 몸무게를 기준으로 추천된 체형이에요.",
                labelClassName: "bg-gray-900 text-white",
                avatars: avatarWeightGroups.reference,
            },
            ...(showAdditionalAvatars && avatarWeightGroups.higher.length > 0
                ? [{
                    key: "higher",
                    label: "기준보다 큰 체형",
                    description: "입력한 몸무게 기준보다 한 단계 큰 체형이에요.",
                    labelClassName: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
                    avatars: avatarWeightGroups.higher,
                }]
                : []),
        ]
        : [{ key: "all", avatars: visibleAvatars }];

    return (
        <main className="min-h-[calc(100vh-6rem)] px-4 py-10">
            <section className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-gray-950">체형 설정</h1>
                        <p className="mt-2 text-sm text-slate-500">내 체형과 가장 가까운 아바타를 만들어 보세요.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500">키·몸무게는 선택 정보</span>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                {step === "information" ? (
                    <motion.form
                        key="information"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        onSubmit={handleSubmit}
                        className="mt-7 space-y-6"
                    >
                        <fieldset className="rounded-2xl bg-slate-50 p-5">
                            <legend className="text-sm font-bold text-gray-800">성별 <span className="text-red-500">*</span></legend>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                {[["MALE", "남성"], ["FEMALE", "여성"]].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setGender(value)}
                                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${gender === value ? "border-violet-600 bg-violet-600 text-white shadow-[0_8px_20px_rgba(124,58,237,0.2)]" : "border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:border-violet-300"}`}
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
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 font-medium outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
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
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 font-medium outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:bg-gray-100 disabled:text-gray-400"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-gray-400">kg</span>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={templateMutation.isPending || avatarMutation.isPending}
                            className="w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-violet-600 disabled:translate-y-0 disabled:bg-gray-300 disabled:shadow-none"
                        >
                            {avatarMutation.isPending ? "아바타 저장 중..." : templateMutation.isPending ? "템플릿 생성 중..." : "체형 템플릿 생성하기"}
                        </button>
                    </motion.form>
                ) : (
                    <motion.div
                        key="selection"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className="mt-7"
                    >
                        <div>
                            <h2 className="text-lg font-bold text-gray-950">체형 선택</h2>
                            <p className="mt-1 text-sm text-gray-500">생성된 체형 중 하나를 선택해 주세요.</p>
                        </div>
                        <motion.div layout className="mt-5 space-y-7">
                            <AnimatePresence initial={false}>
                                {avatarSections.map((section) => (
                                    <motion.section
                                        layout
                                        key={section.key}
                                        initial={section.key === "reference"
                                            ? false
                                            : {
                                                opacity: 0,
                                                y: section.key === "lower" ? 36 : -36,
                                                scale: 0.98,
                                            }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{
                                            layout: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
                                            opacity: { duration: 0.24 },
                                            y: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
                                            scale: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
                                        }}
                                    >
                                        {section.label && (
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${section.labelClassName}`}>
                                                    {section.label}
                                                </span>
                                                <p className="text-xs text-gray-500">{section.description}</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-3 gap-3">
                                            {section.avatars.map((avatar, index) => (
                                                <AvatarOption key={`${getAvatarId(avatar) ?? avatar.bodyType}-${index}`} avatar={avatar} selected={selectedAvatar === avatar} onSelect={setSelectedAvatar} />
                                            ))}
                                        </div>
                                    </motion.section>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                        {hasAdditionalAvatars && !showAdditionalAvatars && (
                            <button
                                type="button"
                                onClick={() => setShowAdditionalAvatars(true)}
                                className="mt-4 w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100"
                            >
                                체형 더 불러오기
                            </button>
                        )}
                        <div className="mt-7 flex gap-3">
                            <button type="button" onClick={() => setStep("information")} className="w-1/3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50">이전</button>
                            <button type="button" onClick={handleNext} disabled={!selectedAvatar || avatarMutation.isPending} className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-violet-600 disabled:translate-y-0 disabled:bg-gray-300 disabled:shadow-none">
                                {avatarMutation.isPending ? "저장 중..." : "아바타 저장하기"}
                            </button>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </section>
        </main>
    );
}
