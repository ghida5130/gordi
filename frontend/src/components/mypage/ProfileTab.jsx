import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { getMyResults, updateNickname } from "@/api/users";
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
        <article className="overflow-hidden rounded-lg border border-slate-100 bg-white">
            <div className="flex aspect-[4/3] items-center justify-center bg-slate-50">
                {result.snapshotImageUrl ? (
                    <img src={result.snapshotImageUrl} alt={`${result.roomCode} 티어메이커 결과`} className="h-full w-full object-cover" />
                ) : (
                    <span className="text-sm text-slate-400">결과 이미지 없음</span>
                )}
            </div>
            <div className="p-5">
                <p className="font-bold text-slate-900">방 코드 {result.roomCode}</p>
                <p className="mt-1 text-sm text-slate-400">{formatDate(result.createdAt)}</p>
            </div>
        </article>
    );
}

export default function ProfileHome({ nickname, profileImageUrl, onHistory }) {
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
                alert("닉네임 형식이 올바르지 않습니다. (특수문자 제외 2~12자)");
            } else {
                alert("닉네임 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
            }
        },
    });

    const handleSave = () => {
        const trimmed = editNickname.trim();
        if (!trimmed) {
            alert("닉네임을 입력해 주세요.");
            return;
        }
        if (!NICKNAME_REGEX.test(trimmed)) {
            alert("닉네임은 특수문자를 제외한 2~12글자로 입력해주세요.");
            return;
        }
        updateName({ nickname: trimmed });
    };

    return (
        <>
            <section className="flex items-center gap-5 border-b border-slate-100 pb-10">
                {profileImageUrl ? (
                    <img src={profileImageUrl} alt="프로필" className="size-20 rounded-full object-cover" />
                ) : (
                    <div className="flex size-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <MyPageIcon name="user" className="size-10" />
                    </div>
                )}
                <div>
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editNickname}
                                onChange={(e) => setEditNickname(e.target.value)}
                                className="text-xl font-bold border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-black max-w-[200px]"
                                placeholder="닉네임 입력"
                                disabled={isPending}
                            />
                            <button
                                type="button"
                                onClick={handleSave}
                                className="text-xs bg-black text-white hover:bg-slate-800 rounded px-2.5 py-1.5 transition-colors font-medium"
                                disabled={isPending}
                            >
                                {isPending ? "저장 중..." : "저장"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="text-xs text-slate-500 hover:text-slate-950 border border-slate-200 hover:border-slate-300 rounded px-2.5 py-1.5 transition-colors"
                                disabled={isPending}
                            >
                                취소
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">{nickname}</h1>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditNickname(nickname);
                                    setIsEditing(true);
                                }}
                                className="text-xs text-slate-400 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded px-1.5 py-0.5 transition-colors"
                            >
                                수정
                            </button>
                        </div>
                    )}
                    <p className="mt-1 text-sm text-slate-400">gordi에서 나의 추천 결과를 확인하세요.</p>
                </div>
            </section>

            <section className="pt-11">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">최근 추천 세션 <span className="text-blue-500">{results.length}</span></h2>
                    <button type="button" onClick={onHistory} className="text-sm font-medium text-slate-400 hover:text-slate-700">전체 보기 〉</button>
                </div>

                {resultsQuery.isPending && (
                    <div className="mt-6 grid gap-5 md:grid-cols-3">
                        {[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-lg bg-slate-100" />)}
                    </div>
                )}
                {resultsQuery.isError && (
                    <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{getApiErrorMessage(resultsQuery.error, "최근 추천 결과를 불러오지 못했습니다.")}</p>
                )}
                {!resultsQuery.isPending && !resultsQuery.isError && recentResults.length === 0 && (
                    <p className="mt-6 rounded-lg bg-slate-50 px-5 py-12 text-center text-sm text-slate-400">아직 완료한 티어메이커 결과가 없습니다.</p>
                )}
                {recentResults.length > 0 && (
                    <div className="mt-6 grid gap-5 md:grid-cols-3">
                        {recentResults.map((result) => <RecentResultCard key={result.resultId} result={result} />)}
                    </div>
                )}
            </section>
        </>
    );
}
