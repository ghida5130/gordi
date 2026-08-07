import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateNickname } from "@/api/users";
import SurfaceCard from "@/components/common/SurfaceCard";
import AvatarTab from "@/components/mypage/AvatarTab";
import MyPageIcon from "@/components/mypage/MyPageIcon";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";

const NICKNAME_REGEX = /^[a-zA-Z가-힣0-9]{2,20}$/;

export default function ProfileHome({ nickname }) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const storeUser = useUserStore((state) => state);
    const setUser = useUserStore((state) => state.setUser);

    const [isEditing, setIsEditing] = useState(false);
    const [editNickname, setEditNickname] = useState(nickname);

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
                toast.warning("닉네임은 특수문자를 제외한 2~20자로 입력해 주세요.");
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
            toast.warning("닉네임은 특수문자를 제외한 2~20자로 입력해 주세요.");
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
                                maxLength={20}
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
                    <p className="mt-2 text-sm text-slate-500">내 프로필과 아바타 정보를 관리해 보세요.</p>
                </div>
            </SurfaceCard>

            <div className="mt-7">
                <AvatarTab />
            </div>
        </>
    );
}
