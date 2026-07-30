import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { getMyInfo } from "@/api/users";
import PageContainer from "@/components/common/PageContainer";
import { useUserStore } from "@/stores/useUserStore";
import { getRoomSession } from "@/utils/roomSessionStorage";

const tabs = [
  { id: "profile", label: "프로필" },
  { id: "avatar", label: "아바타" },
  { id: "history", label: "결과" },
  { id: "collection", label: "모아보기" },
];

function Icon({ name, className = "" }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20v-1.25a6.5 6.5 0 0 1 13 0V20" /></>,
    hanger: <><path d="M12 4.5a2.5 2.5 0 1 1 2.5 2.5" /><path d="m12 7 6.6 7.15a1.55 1.55 0 0 1-1.14 2.6H6.54a1.55 1.55 0 0 1-1.14-2.6L12 7Z" /></>,
    edit: <><path d="m4 20 3.5-.85L18 8.65 15.35 6 4.85 16.5 4 20Z" /><path d="m14.75 6.6 2.65 2.65" /></>,
    bookmark: <path d="M6.5 4.5h11v15l-5.5-3-5.5 3v-15Z" />,
    heart: <path d="M20 8.75C20 13 12 18.5 12 18.5S4 13 4 8.75A3.75 3.75 0 0 1 10.5 6.2L12 7.7l1.5-1.5A3.75 3.75 0 0 1 20 8.75Z" />,
    check: <path d="m5 12 4.25 4.25L19 6.5" />,
    users: <><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="7" r="3" /><path d="M17 11a3 3 0 1 0-1.5-5.6" /><path d="M18 14a4 4 0 0 1 3 3.87V19" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    search: <><circle cx="10.75" cy="10.75" r="5.25" /><path d="m15 15 4 4" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {paths[name]}
    </svg>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
      <Icon name="hanger" className="size-10 text-slate-300" />
      <p className="mt-4 font-medium text-slate-500">{message}</p>
    </div>
  );
}

function MyPage() {
  const navigate = useNavigate();
  const storedUser = useUserStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [isRoomNoticeOpen, setIsRoomNoticeOpen] = useState(true);
  const [collectionCategory, setCollectionCategory] = useState("전체");
  const [searchTerm, setSearchTerm] = useState("");
  const roomSession = useMemo(getRoomSession, []);

  const myInfoQuery = useQuery({
    queryKey: ["myInfo"],
    queryFn: getMyInfo,
    retry: false,
  });

  const user = myInfoQuery.data?.data ?? {};
  const nickname = user.nickname ?? storedUser.nickname ?? "사용자";
  const profileImageUrl = user.avatar?.imageUrl ?? storedUser.profileImageUrl;
  const bodyType = user.avatar?.bodyType ?? "미설정";
  const height = user.avatar?.height;
  const weight = user.avatar?.weight;

  const renderProfile = () => {
    if (isEditing) {
      return (
        <section className="mx-auto max-w-xl rounded-3xl border bg-white p-6 sm:p-9">
          <button type="button" onClick={() => setIsEditing(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">← 프로필로 돌아가기</button>
          <h1 className="mt-5 text-2xl font-bold">프로필 수정</h1>
          <p className="mt-1 text-sm text-slate-400">계정 정보를 변경합니다</p>
          <div className="mt-8 flex justify-center">
            {profileImageUrl ? <img src={profileImageUrl} alt="프로필" className="size-24 rounded-full object-cover" /> : <div className="flex size-24 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="user" className="size-11" /></div>}
          </div>
          <div className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-slate-600">아이디<input value={user.email ?? storedUser.email ?? ""} readOnly className="mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-slate-500 outline-none" /></label>
            <label className="block text-sm font-medium text-slate-600">이름<input defaultValue={nickname} className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-slate-900" /></label>
            <label className="block text-sm font-medium text-slate-600">새 비밀번호<input type="password" placeholder="새 비밀번호를 입력하세요" className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-slate-900" /></label>
            <label className="block text-sm font-medium text-slate-600">비밀번호 확인<input type="password" placeholder="비밀번호를 다시 입력하세요" className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-slate-900" /></label>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3"><button type="button" onClick={() => setIsEditing(false)} className="rounded-2xl bg-slate-100 py-3 font-semibold text-slate-600">취소</button><button type="button" onClick={() => setIsEditing(false)} className="rounded-2xl bg-slate-950 py-3 font-semibold text-white">저장하기</button></div>
        </section>
      );
    }

    return (
      <>
        <section className="flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {profileImageUrl ? <img src={profileImageUrl} alt="프로필" className="size-18 rounded-full object-cover sm:size-20" /> : <div className="flex size-18 items-center justify-center rounded-full bg-slate-100 text-slate-400 sm:size-20"><Icon name="user" className="size-9" /></div>}
            <div><h1 className="text-2xl font-bold">{nickname}</h1><p className="mt-1 text-slate-400">{bodyType} · {height ? `${height}cm` : "키 미설정"} · {weight ? `${weight}kg` : "몸무게 미설정"}</p></div>
          </div>
          <div className="flex items-center gap-6 sm:gap-8"><div className="text-center"><Icon name="bookmark" className="mx-auto size-5 text-slate-400" /><strong className="mt-1 block text-lg">0</strong><span className="text-xs text-slate-400">모아보기</span></div><div className="text-center"><Icon name="heart" className="mx-auto size-5 text-slate-400" /><strong className="mt-1 block text-lg">0</strong><span className="text-xs text-slate-400">좋아요</span></div><div className="text-center"><Icon name="check" className="mx-auto size-5 text-slate-400" /><strong className="mt-1 block text-lg">0</strong><span className="text-xs text-slate-400">확정 의상</span></div><button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-slate-50"><Icon name="edit" className="size-4" />프로필 수정</button></div>
        </section>
        <section className="pt-10"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">최근 추천 세션 <span className="text-blue-500">0</span></h2><button type="button" onClick={() => setActiveTab("history")} className="text-sm text-slate-400 hover:text-slate-700">전체 보기 →</button></div><div className="mt-5"><EmptyState message="아직 추천받은 의상이 없습니다." /></div></section>
      </>
    );
  };

  const renderAvatar = () => <section className="mx-auto max-w-4xl"><div className="rounded-3xl border bg-white p-6 sm:p-8"><h1 className="text-2xl font-bold">아바타 설정</h1><p className="mt-2 text-sm text-slate-400">신체 정보와 체형을 설정해 의상 추천에 반영합니다.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium text-slate-600">성별<select className="mt-2 w-full rounded-2xl border bg-white px-4 py-3"><option>선택 안 함</option><option>남성</option><option>여성</option></select></label><label className="text-sm font-medium text-slate-600">체형<select className="mt-2 w-full rounded-2xl border bg-white px-4 py-3"><option>밸런스</option><option>상체형</option><option>하체형</option></select></label><label className="text-sm font-medium text-slate-600">키 (cm)<input type="number" defaultValue={height ?? ""} placeholder="예: 176" className="mt-2 w-full rounded-2xl border px-4 py-3" /></label><label className="text-sm font-medium text-slate-600">몸무게 (kg)<input type="number" defaultValue={weight ?? ""} placeholder="예: 68" className="mt-2 w-full rounded-2xl border px-4 py-3" /></label></div><button type="button" className="mt-7 w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white">아바타 저장하기</button></div></section>;

  const renderHistory = () => <section><div className="flex items-end justify-between"><div><h1 className="text-2xl font-bold">내 기록</h1><p className="mt-1 text-slate-400">지난 추천 · 결과 과정 · 패션 목록</p></div><span className="text-sm text-slate-400">총 0개 세션</span></div><div className="mt-8"><EmptyState message="완료된 추천 세션이 없습니다." /></div></section>;

  const renderCollection = () => <section><div className="flex flex-wrap items-center justify-between gap-4 border-b"><div className="flex gap-6">{["전체", "아우터", "상의", "하의"].map((category) => <button key={category} type="button" onClick={() => setCollectionCategory(category)} className={`border-b-2 px-1 pb-4 text-sm font-semibold ${collectionCategory === category ? "border-slate-950 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-700"}`}>{category}</button>)}</div><label className="relative mb-3"><Icon name="search" className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="검색" className="w-44 rounded-xl border bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500" /></label></div><div className="mt-8"><EmptyState message={`${collectionCategory} 카테고리에 저장된 의상이 없습니다.`} /></div></section>;

  return (
    <main className="min-h-screen bg-white pb-28 text-slate-900">
      <header className="border-b"><PageContainer className="flex h-17 items-center justify-between"><Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight"><Icon name="hanger" className="size-6" />gordi</Link><nav className="hidden gap-9 text-sm font-medium text-slate-500 sm:flex"><Link to="/tierm" className="hover:text-slate-950">티어메이커</Link><Link to="/rooms" className="hover:text-slate-950">의상 추천</Link></nav><div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon name="user" className="size-5" /></div></PageContainer></header>
      <nav className="border-b"><PageContainer className="flex gap-7">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => { setIsEditing(false); setActiveTab(tab.id); }} className={`border-b-2 py-4 text-sm font-semibold ${activeTab === tab.id ? "border-slate-950 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-700"}`}>{tab.label}</button>)}</PageContainer></nav>
      <PageContainer className="pt-10">{myInfoQuery.isLoading ? <div className="h-64 animate-pulse rounded-3xl bg-slate-100" /> : activeTab === "profile" ? renderProfile() : activeTab === "avatar" ? renderAvatar() : activeTab === "history" ? renderHistory() : renderCollection()}</PageContainer>
      {isRoomNoticeOpen && roomSession?.roomId && <aside className="fixed inset-x-4 bottom-5 z-10 mx-auto flex max-w-md items-center gap-4 rounded-3xl bg-slate-950 p-4 text-white shadow-2xl shadow-slate-900/20"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Icon name="users" className="size-6" /></div><div className="min-w-0 flex-1"><p className="text-xs font-medium text-amber-200">진행 중인 방</p><p className="truncate font-bold">{roomSession.roomName ?? "참여 중인 의상 고르기 방"}</p><p className="text-xs text-slate-300">참여자 {roomSession.participantCount ?? 1}명 · 티어링크 진행 중</p></div><button type="button" onClick={() => navigate(`/rooms/${roomSession.roomId}`)} className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-950">입장 <span aria-hidden="true">→</span></button><button type="button" onClick={() => setIsRoomNoticeOpen(false)} aria-label="진행 중인 방 알림 닫기" className="shrink-0 text-slate-400 hover:text-white">×</button></aside>}
    </main>
  );
}

export default MyPage;
