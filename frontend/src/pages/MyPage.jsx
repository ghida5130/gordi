import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { logout } from "@/api/auth";
import { getMyInfo } from "@/api/users";
import PageContainer from "@/components/common/PageContainer";
import AvatarTab from "@/components/mypage/AvatarTab";
import CollectionTab from "@/components/mypage/CollectionTab";
import HistoryTab from "@/components/mypage/HistoryTab";
import LogoutModal from "@/components/mypage/LogoutModal";
import MyPageTabs from "@/components/mypage/MyPageTabs";
import { ProfileEdit, ProfileHome } from "@/components/mypage/ProfileTab";
import RoomSessionNotice from "@/components/mypage/RoomSessionNotice";
import { useUserStore } from "@/stores/useUserStore";
import { removeBodyInformation } from "@/utils/bodyInformationStorage";
import { getRoomSession, removeRoomSession } from "@/utils/roomSessionStorage";
import { removeAccessToken } from "@/utils/tokenStorage";

function MyPage() {
    const navigate = useNavigate();
    const clearUser = useUserStore((state) => state.clearUser);
    const storedNickname = useUserStore((state) => state.nickname);
    const storedProfileImageUrl = useUserStore((state) => state.profileImageUrl);
    const [activeTab, setActiveTab] = useState("profile");
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [gender, setGender] = useState("남성");
    const [bodyType, setBodyType] = useState("밸런스");
    const roomSession = useMemo(() => getRoomSession(), []);
    const [isRoomNoticeOpen, setIsRoomNoticeOpen] = useState(true);

    const { data } = useQuery({ queryKey: ["myInfo"], queryFn: getMyInfo, retry: false });
    const user = data?.data ?? {};
    const nickname = user.nickname ?? storedNickname ?? "김민준";
    const profileImageUrl = user.avatar?.imageUrl ?? storedProfileImageUrl;
    const height = user.avatar?.height ?? 176;
    const weight = user.avatar?.weight ?? 68;

    const logoutMutation = useMutation({
        mutationFn: logout,
        onSettled: () => {
            removeAccessToken();
            removeBodyInformation();
            removeRoomSession();
            clearUser();
            navigate("/login", { replace: true });
        },
    });

    const changeTab = (tab) => {
        setActiveTab(tab);
        setIsEditing(false);
    };

    const profile = isEditing ? (
        <ProfileEdit nickname={nickname} profileImageUrl={profileImageUrl} onCancel={() => setIsEditing(false)} />
    ) : (
        <ProfileHome nickname={nickname} profileImageUrl={profileImageUrl} height={height} weight={weight} onEdit={() => setIsEditing(true)} onHistory={() => changeTab("history")} />
    );

    return (
        <main className="min-h-screen bg-white pb-20 text-slate-900">
            <MyPageTabs activeTab={activeTab} onChange={changeTab} />
            <PageContainer className="pt-10">
                {activeTab === "profile" && profile}
                {activeTab === "avatar" && <AvatarTab gender={gender} setGender={setGender} bodyType={bodyType} setBodyType={setBodyType} height={height} weight={weight} />}
                {activeTab === "history" && <HistoryTab />}
                {activeTab === "collection" && <CollectionTab />}
            </PageContainer>
            {isRoomNoticeOpen && roomSession?.roomId && (
                <RoomSessionNotice roomSession={roomSession} onEnter={() => navigate(`/rooms/${roomSession.roomId}`)} onClose={() => setIsRoomNoticeOpen(false)} />
            )}
            {isLogoutModalOpen && <LogoutModal isPending={logoutMutation.isPending} onCancel={() => setIsLogoutModalOpen(false)} onConfirm={() => logoutMutation.mutate()} />}
        </main>
    );
}

export default MyPage;
