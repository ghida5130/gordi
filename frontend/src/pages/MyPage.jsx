import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { getMyActiveRoom, getMyInfo } from "@/api/users";
import PageContainer from "@/components/common/PageContainer";
import AvatarTab from "@/components/mypage/AvatarTab";
import HistoryTab from "@/components/mypage/HistoryTab";
import MyPageTabs from "@/components/mypage/MyPageTabs";
import ProfileHome from "@/components/mypage/ProfileTab";
import RoomSessionNotice from "@/components/mypage/RoomSessionNotice";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";
import { getApiErrorMessage } from "@/utils/apiError";

function MyPage() {
    const location = useLocation();
    const toast = useToast();
    const joinRoomMutation = useJoinRoom();
    const storedNickname = useUserStore((state) => state.nickname);
    const [tabSelection, setTabSelection] = useState(() => ({
        locationKey: location.key,
        activeTab: location.state?.activeTab ?? "profile",
    }));
    const [isRoomNoticeOpen, setIsRoomNoticeOpen] = useState(true);
    const { data } = useQuery({ queryKey: ["myInfo"], queryFn: getMyInfo, retry: false });
    const { data: activeRoomData } = useQuery({
        queryKey: ["myActiveRoom"],
        queryFn: getMyActiveRoom,
        retry: false,
        staleTime: 0,
        refetchOnMount: "always",
    });
    const user = data?.data ?? {};
    const activeRoom = activeRoomData?.data?.activeRoom ?? null;
    const nickname = user.nickname ?? storedNickname ?? "사용자";
    const activeTab = tabSelection.locationKey === location.key
        ? tabSelection.activeTab
        : (location.state?.activeTab ?? "profile");
    const handleTabChange = (nextTab) => {
        setTabSelection({ locationKey: location.key, activeTab: nextTab });
    };

    const handleEnterActiveRoom = () => {
        if (!activeRoom?.roomCode || joinRoomMutation.isPending) return;

        joinRoomMutation.mutate(
            {
                roomCode: activeRoom.roomCode,
                nickname,
            },
            {
                onError: (error) => {
                    toast.error(
                        getApiErrorMessage(
                            error,
                            "진행 중인 방에 다시 입장하지 못했습니다.",
                        ),
                    );
                },
            },
        );
    };

    return (
        <main className="min-h-screen bg-gray-50 pb-20 text-slate-900">
            <MyPageTabs activeTab={activeTab} onChange={handleTabChange} />
            <PageContainer className="pt-10">
                {activeTab === "profile" && <ProfileHome nickname={nickname} onHistory={() => handleTabChange("history")} />}
                {activeTab === "avatar" && <AvatarTab />}
                {activeTab === "history" && <HistoryTab />}
            </PageContainer>
            {isRoomNoticeOpen && activeRoom?.roomId && (
                <RoomSessionNotice
                    activeRoom={activeRoom}
                    onEnter={handleEnterActiveRoom}
                    onClose={() => setIsRoomNoticeOpen(false)}
                    isEntering={joinRoomMutation.isPending}
                />
            )}
        </main>
    );
}

export default MyPage;
