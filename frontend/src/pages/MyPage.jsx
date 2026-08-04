import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { getMyActiveRoom, getMyInfo } from "@/api/users";
import PageContainer from "@/components/common/PageContainer";
import AvatarTab from "@/components/mypage/AvatarTab";
import HistoryTab from "@/components/mypage/HistoryTab";
import MyPageTabs from "@/components/mypage/MyPageTabs";
import ProfileHome from "@/components/mypage/ProfileTab";
import RoomSessionNotice from "@/components/mypage/RoomSessionNotice";
import { useUserStore } from "@/stores/useUserStore";

function MyPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const storedNickname = useUserStore((state) => state.nickname);
    const [activeTab, setActiveTab] = useState(location.state?.activeTab ?? "profile");
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

    return (
        <main className="min-h-screen bg-gray-50 pb-20 text-slate-900">
            <MyPageTabs activeTab={activeTab} onChange={setActiveTab} />
            <PageContainer className="pt-10">
                {activeTab === "profile" && <ProfileHome nickname={nickname} onHistory={() => setActiveTab("history")} />}
                {activeTab === "avatar" && <AvatarTab />}
                {activeTab === "history" && <HistoryTab />}
            </PageContainer>
            {isRoomNoticeOpen && activeRoom?.roomId && (
                <RoomSessionNotice
                    activeRoom={activeRoom}
                    onEnter={() => navigate(`/rooms/${activeRoom.roomId}`)}
                    onClose={() => setIsRoomNoticeOpen(false)}
                />
            )}
        </main>
    );
}

export default MyPage;
