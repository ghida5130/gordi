import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";

import { getMyResults, updateNickname } from "@/api/users";
import StatusPanel from "@/components/common/StatusPanel";
import SurfaceCard from "@/components/common/SurfaceCard";
import MyPageIcon from "@/components/mypage/MyPageIcon";
import { useToast } from "@/hooks/useToast";
import { getApiErrorMessage } from "@/utils/apiError";
import { useUserStore } from "@/stores/useUserStore";

const NICKNAME_REGEX = /^[a-zA-Z가-힣0-9]{2,12}$/;

function formatDate(createdAt) {
    return createdAt ? createdAt.slice(0, 10).replaceAll("-", ". ") : "날짜 없음";
}

function RecentResultCard({ result }) {
    return (
        <motion.article
            whileHover={{ y: -3 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
        >
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-50">
                {result.snapshotImageUrl ? (
                    <img src={result.snapshotImageUrl} alt={`${result.roomCode} 티어메이커 결과`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
                ) : (
                    <span className="text-sm text-slate-400">결과 이미지 없음</span>
                )}
            </div>
            <div className="p-5">
                <p className="font-bold text-slate-900">방 코드 {result.roomCode}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDate(result.createdAt)}</p>
            </div>
        </motion.article>
    );
}

export default function ProfileHome({ nickname, onHistory }) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const storeUser = useUserStore((state) => state);
    const setUser = useUserStore((state) => state.setUser);

    const [isEditing, setIsEditing] = useState(false);
    const [editNickname, setEditNickname] = useState(nickname);

    const resultsQuery = useQuery({ queryKey: ["myResults"], queryFn: getMyResults, retry: false });
    const results = resultsQuery.data?.data?.items ?? resultsQuery.data?.items ?? [];
    const recentResults = results.slice(0, 3);

    const { mutate: updateName, isPending } = useMutation({
        mutationFn: updateNickname,
        onSuccess: () => {
            toast.success("닉네임이 성공적으로 변경되었습니다.");
            queryClient.invalidateQueries({ queryKey: ["myInfo"] });
            setUser({
                ...storeUser,
                nickname: editNickname,
            });
            setIsEditing(false);
        },
        onError: (error) => {
            const status = error.response?.status;
            const errorCode = error.response?.data?.code;
            if (status === 400 || errorCode === "INVALID_NICKNAME") {
                toast.warning("닉네임은 특수문자를 제외한 2~12자로 입력해 주세요.");
            } else {
                toast.error("닉네임 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
            }
        },
    });

    const handleSave = () => {
        const trimmed = editNickname.trim();
        if (!trimmed) {
            toast.warning("닉네임을 입력해 주세요.");
            return;
        }
        if (!NICKNAME_REGEX.test(trimmed)) {
            toast.warning("닉네임은 특수문자를 제외한 2~12자로 입력해 주세요.");
            return;
        }
        updateName({ nickname: trimmed });
    };

    return (
        <>
            <SurfaceCard className="flex items-center gap-6 p-8">
                <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 to-emerald-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                    <MyPageIcon name="user" className="size-10" />
                </div>
                <div className="min-w-0 flex-1">
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editNickname}
                                onChange={(e) => setEditNickname(e.target.value)}
                                className="h-11 max-w-[240px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-bold outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                                placeholder="닉네임 입력"
                                disabled={isPending}
                            />
                            <button
                                type="button"
                                onClick={handleSave}
                                className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
                                disabled={isPending}
                            >
                                {isPending ? "저장 중..." : "저장"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-wait disabled:opacity-50"
                                disabled={isPending}
                            >
                                취소
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black tracking-tight">{nickname}</h1>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditNickname(nickname);
                                    setIsEditing(true);
                                }}
                                className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-bold text-slate-500 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                            >
                                수정
                            </button>
                        </div>
                    )}
                    <p className="mt-2 text-sm text-slate-500">내 아바타와 지금까지 완성한 티어메이커 결과를 관리해 보세요.</p>
                </div>
            </SurfaceCard>

            <SurfaceCard className="mt-7 p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black">최근 티어메이커 <span className="text-violet-600">{results.length}</span></h2>
                    </div>
                    <button type="button" onClick={onHistory} className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-950 hover:text-white">전체 보기 →</button>
                </div>

                {resultsQuery.isPending && (
                    <div className="mt-6 grid gap-5 md:grid-cols-3">
                        {[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-slate-100" />)}
                    </div>
                )}
                {resultsQuery.isError && (
                    <StatusPanel tone="danger" role="alert" className="mt-6">{getApiErrorMessage(resultsQuery.error, "최근 추천 결과를 불러오지 못했습니다.")}</StatusPanel>
                )}
                {!resultsQuery.isPending && !resultsQuery.isError && recentResults.length === 0 && (
                    <StatusPanel className="mt-6 py-12 text-center text-slate-500">아직 완료한 티어메이커 결과가 없습니다.</StatusPanel>
                )}
                {recentResults.length > 0 && (
                    <div className="mt-6 grid gap-5 md:grid-cols-3">
                        {recentResults.map((result) => <RecentResultCard key={result.resultId} result={result} />)}
                    </div>
                )}
            </SurfaceCard>
        </>
    );
}
