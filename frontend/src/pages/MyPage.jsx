import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { getMyInfo } from "@/api/users";
import PageContainer from "@/components/common/PageContainer";
import AvatarTab from "@/components/mypage/AvatarTab";
import HistoryTab from "@/components/mypage/HistoryTab";
import MyPageTabs from "@/components/mypage/MyPageTabs";
import ProfileHome from "@/components/mypage/ProfileTab";
import RoomSessionNotice from "@/components/mypage/RoomSessionNotice";
import { useUserStore } from "@/stores/useUserStore";
import { getRoomSession } from "@/utils/roomSessionStorage";

function MyPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const storedNickname = useUserStore((state) => state.nickname);
    const storedProfileImageUrl = useUserStore((state) => state.profileImageUrl);
    const [activeTab, setActiveTab] = useState(location.state?.activeTab ?? "profile");
    const roomSession = useMemo(() => getRoomSession(), []);
    const [isRoomNoticeOpen, setIsRoomNoticeOpen] = useState(true);
    const { data } = useQuery({ queryKey: ["myInfo"], queryFn: getMyInfo, retry: false });
    const user = data?.data ?? {};
    const nickname = user.nickname ?? storedNickname ?? "사용자";
    const profileImageUrl = user.avatar?.imageUrl ?? storedProfileImageUrl;

    return (
        <main className="min-h-screen bg-white pb-20 text-slate-900">
            <MyPageTabs activeTab={activeTab} onChange={setActiveTab} />
            <PageContainer className="pt-10">
                {activeTab === "profile" && <ProfileHome nickname={nickname} profileImageUrl={profileImageUrl} onHistory={() => setActiveTab("history")} />}
                {activeTab === "avatar" && <AvatarTab />}
                {activeTab === "history" && <HistoryTab />}
            </PageContainer>
            {isRoomNoticeOpen && roomSession?.roomId && (
                <RoomSessionNotice roomSession={roomSession} onEnter={() => navigate(`/rooms/${roomSession.roomId}`)} onClose={() => setIsRoomNoticeOpen(false)} />
            )}
        </main>
    );
}

export default MyPage;
