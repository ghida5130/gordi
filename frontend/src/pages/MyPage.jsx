import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { logout } from "@/api/auth";
import { getMyInfo } from "@/api/users";
import PageContainer from "@/components/common/PageContainer";
import { useUserStore } from "@/stores/useUserStore";
import { getRoomSession, removeRoomSession } from "@/utils/roomSessionStorage";
import { removeAccessToken } from "@/utils/tokenStorage";

const TABS = [
  ["profile", "프로필"],
  ["avatar", "아바타"],
  ["history", "결과"],
  ["collection", "모아보기"],
];

const SESSIONS = [
  { date: "2026-07-19", category: "아우터", count: 3, budget: "₩80K-₩200K", items: ["수플레 슬림 재킷", "더블 브레스트 블레이저", "오버핏 코트"] },
  { date: "2026-07-12", category: "상의", count: 1, budget: "₩30K-₩150K", items: ["수플레 슬림 재킷"] },
  { date: "2026-07-05", category: "아우터", count: 3, budget: "₩80K-₩200K", items: ["울 플랜트 트렌치", "카시미어 플랜드 코트", "리넨 테일러드 자켓"] },
];

function Icon({ name, className = "" }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20v-1.25a6.5 6.5 0 0 1 13 0V20" /></>,
    hanger: <><path d="M12 4.5a2.5 2.5 0 1 1 2.5 2.5" /><path d="m12 7 6.6 7.15a1.55 1.55 0 0 1-1.14 2.6H6.54a1.55 1.55 0 0 1-1.14-2.6L12 7Z" /></>,
    edit: <><path d="m4 20 3.5-.85L18 8.65 15.35 6 4.85 16.5 4 20Z" /><path d="m14.75 6.6 2.65 2.65" /></>,
    bookmark: <path d="M6.5 4.5h11v15l-5.5-3-5.5 3v-15Z" />,
    heart: <path d="M20 8.75C20 13 12 18.5 12 18.5S4 13 4 8.75A3.75 3.75 0 0 1 10.5 6.2L12 7.7l1.5-1.5A3.75 3.75 0 0 1 20 8.75Z" />,
    check: <path d="m5 12 4.25 4.25L19 6.5" />,
    logout: <><path d="M10 5H5v14h5" /><path d="M13 8l4 4-4 4" /><path d="M9 12h8" /></>,
    users: <><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="7" r="3" /><path d="M17 11a3 3 0 1 0-1.5-5.6" /></>,
    sparkle: <><path d="m12 3 .8 4.2L17 8l-4.2.8L12 13l-.8-4.2L7 8l4.2-.8L12 3Z" /><path d="m19 14 .45 2.55L22 17l-2.55.45L19 20l-.45-2.55L16 17l2.55-.45L19 14Z" /></>,
    shirt: <path d="m8.2 5.5 2 1.5h3.6l2-1.5L21 9l-2.5 3-2-1.2V20H7.5v-9.2l-2 1.2L3 9l5.2-3.5Z" />,
    chart: <><path d="M5 20v-5" /><path d="M12 20V9" /><path d="M19 20V4" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>,
    box: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16" /><path d="M9 5V3h6v2" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  };

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function ClothingPlaceholder({ rank }) {
  return <div className="relative flex h-72 items-center justify-center bg-slate-50 sm:h-78">{rank && <span className="absolute top-10 text-sm font-medium text-slate-400">{rank}위</span>}<Icon name="hanger" className="size-9 text-slate-300" /></div>;
}

function AvatarFigure({ compact = false }) {
  return <div className={`relative mx-auto ${compact ? "h-60 w-28" : "h-40 w-20"}`} aria-label="아바타 미리보기"><span className="absolute left-1/2 top-0 size-9 -translate-x-1/2 rounded-full bg-[#c6ad85]" /><span className="absolute left-1/2 top-[-6px] h-2 w-14 -translate-x-1/2 rounded-sm bg-zinc-700" /><span className="absolute left-1/2 top-12 h-22 w-13 -translate-x-1/2 rounded-xl bg-zinc-800" /><span className="absolute left-0 top-14 h-16 w-6 rounded-full bg-zinc-800" /><span className="absolute right-0 top-14 h-16 w-6 rounded-full bg-zinc-800" /><span className="absolute left-6 top-34 h-22 w-6 rounded-lg bg-zinc-900" /><span className="absolute right-6 top-34 h-22 w-6 rounded-lg bg-zinc-900" /></div>;
}

function SessionCard({ session }) {
  return <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white"><div className="relative"><span className="absolute left-3 top-3 rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">같이 고르기</span><ClothingPlaceholder /></div><div className="p-5"><p className="font-bold">{session.category} · {session.count}개 확정</p><p className="mt-1 text-sm text-slate-400">{session.date}</p><p className="text-xs text-slate-400">{session.budget}</p><div className="mt-3 flex flex-wrap gap-1.5">{session.items.slice(0, 2).map((item) => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item}</span>)}{session.items.length > 2 && <span className="py-1 text-xs text-slate-400">+1개</span>}</div></div></article>;
}

function Dropdown({ type }) {
  const menus = type === "tier" ? [
    ["sparkle", "AI 추천받기", "TPO·예산·스타일 입력으로 10벌 추천", "bg-amber-50"],
    ["shirt", "카테고리별 추천", "아우터, 상의, 하의 별로 골라요", "bg-rose-50"],
    ["chart", "내 추천 기록", "지난 AI 추천 세션을 확인해요", "bg-orange-50"],
  ] : [
    ["users", "같이 고르기", "친구들과 함께 의상을 골라요", "bg-blue-50"],
    ["layers", "혼자 고르기", "나만의 스타일을 찾아요", "bg-violet-50"],
    ["box", "방 만들기", "새로운 티어 방을 시작해요", "bg-emerald-50"],
  ];

  return <div className="absolute left-1/2 top-full z-30 w-106 -translate-x-1/2 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl shadow-slate-300/40">{menus.map(([icon, title, description, color]) => <button key={title} type="button" className="flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left hover:bg-slate-50"><span className={`flex size-13 shrink-0 items-center justify-center rounded-2xl ${color} text-slate-600`}><Icon name={icon} className="size-6" /></span><span><strong className="block">{title}</strong><small className="mt-0.5 block text-sm text-slate-400">{description}</small></span></button>)}</div>;
}

function MyPage() {
  const navigate = useNavigate();
  const clearUser = useUserStore((state) => state.clearUser);
  const storedNickname = useUserStore((state) => state.nickname);
  const storedProfileImageUrl = useUserStore((state) => state.profileImageUrl);
  const [activeTab, setActiveTab] = useState("profile");
  const [openMenu, setOpenMenu] = useState(null);
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
      removeRoomSession();
      clearUser();
      navigate("/login", { replace: true });
    },
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    setIsEditing(false);
  };

  const profile = isEditing ? <ProfileEdit nickname={nickname} profileImageUrl={profileImageUrl} onCancel={() => setIsEditing(false)} /> : <ProfileHome nickname={nickname} profileImageUrl={profileImageUrl} height={height} weight={weight} onEdit={() => setIsEditing(true)} onHistory={() => changeTab("history")} />;

  return <main className="min-h-screen bg-white pb-20 text-slate-900">
    <header className="border-y border-slate-100"><PageContainer className="flex h-17 items-center justify-between">
      <Link to="/mypage" className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Icon name="hanger" className="size-6" />gordi</Link>
      <nav className="hidden h-full items-center gap-10 sm:flex">{[["tier", "티어메이커"], ["recommend", "의상 추천"]].map(([type, label]) => <div key={type} className="relative flex h-full items-center" onMouseEnter={() => setOpenMenu(type)} onMouseLeave={() => setOpenMenu(null)}><button type="button" className="py-5 text-lg font-semibold text-slate-500 hover:text-slate-950">{label}</button>{openMenu === type && <Dropdown type={type} />}</div>)}</nav>
      <div className="flex items-center gap-5"><button type="button" onClick={() => setIsLogoutModalOpen(true)} className="hidden items-center gap-2 text-base font-semibold text-slate-400 hover:text-slate-950 sm:flex"><Icon name="logout" className="size-5" />로그아웃</button><div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon name="user" className="size-5" /></div></div>
    </PageContainer></header>
    <nav className="border-b border-slate-100"><PageContainer className="flex gap-8">{TABS.map(([id, label]) => <button key={id} type="button" onClick={() => changeTab(id)} className={`border-b-2 px-1 py-5 text-lg font-semibold ${activeTab === id ? "border-slate-950 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-700"}`}>{label}</button>)}</PageContainer></nav>
    <PageContainer className="pt-10">{activeTab === "profile" && profile}{activeTab === "avatar" && <AvatarTab gender={gender} setGender={setGender} bodyType={bodyType} setBodyType={setBodyType} height={height} weight={weight} />}{activeTab === "history" && <HistoryTab />}{activeTab === "collection" && <CollectionTab />}</PageContainer>
    {isRoomNoticeOpen && roomSession?.roomId && <aside className="fixed inset-x-4 bottom-5 z-20 mx-auto flex max-w-md items-center gap-4 rounded-3xl bg-slate-950 p-4 text-white shadow-2xl"><span className="flex size-12 items-center justify-center rounded-2xl bg-white/10"><Icon name="users" className="size-6" /></span><span className="min-w-0 flex-1"><small className="block text-amber-200">진행 중인 방</small><strong className="block truncate">{roomSession.roomName ?? "참여 중인 의상 고르기 방"}</strong><small className="text-slate-300">참여자 {roomSession.participantCount ?? 1}명 · 티어링크 진행 중</small></span><button type="button" onClick={() => navigate(`/rooms/${roomSession.roomId}`)} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-950">입장 →</button><button type="button" onClick={() => setIsRoomNoticeOpen(false)} aria-label="진행 중인 방 알림 닫기" className="text-lg text-slate-400 hover:text-white">×</button></aside>}
    {isLogoutModalOpen && <LogoutModal isPending={logoutMutation.isPending} onCancel={() => setIsLogoutModalOpen(false)} onConfirm={() => logoutMutation.mutate()} />}
  </main>;
}

function ProfileHome({ nickname, profileImageUrl, height, weight, onEdit, onHistory }) {
  return <><section className="flex items-center justify-between border-b border-slate-100 pb-10"><div className="flex items-center gap-5">{profileImageUrl ? <img src={profileImageUrl} alt="프로필" className="size-20 rounded-full object-cover" /> : <div className="flex size-20 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="user" className="size-10" /></div>}<div><h1 className="text-2xl font-bold">{nickname}</h1><p className="mt-1 text-lg text-slate-400">밸런스형 · {height}cm · {weight}kg</p></div></div><div className="flex items-center gap-7"><Stat icon="bookmark" value="8" label="모아보기" /><Stat icon="heart" value="4" label="좋아요" /><Stat icon="check" value="5" label="확정 의상" /><button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-base font-semibold hover:bg-slate-50"><Icon name="edit" className="size-5" />프로필 수정</button></div></section><section className="pt-11"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">최근 추천 세션 <span className="text-blue-500">3</span></h2><button type="button" onClick={onHistory} className="text-sm font-medium text-slate-400 hover:text-slate-700">전체 보기 〉</button></div><div className="mt-6 grid gap-5 md:grid-cols-3">{SESSIONS.map((session) => <SessionCard key={session.date} session={session} />)}</div></section></>;
}

function Stat({ icon, value, label }) { return <div className="text-center"><Icon name={icon} className="mx-auto size-5 text-slate-400" /><strong className="mt-1 block text-xl">{value}</strong><small className="text-slate-400">{label}</small></div>; }

function ProfileEdit({ nickname, profileImageUrl, onCancel }) { return <section className="mx-auto max-w-2xl"><button type="button" onClick={onCancel} className="text-sm font-medium text-slate-400 hover:text-slate-950">〈 프로필</button><h1 className="mt-3 text-2xl font-bold">프로필 수정</h1><p className="mt-1 text-slate-400">계정 정보를 변경합니다</p><div className="mt-8 rounded-3xl border border-slate-200 p-9"><div className="flex justify-center">{profileImageUrl ? <img src={profileImageUrl} alt="프로필" className="size-26 rounded-full object-cover" /> : <div className="flex size-26 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="user" className="size-12" /></div>}</div><div className="mt-8 space-y-5"><Field label="아이디" value="kiminjun" readOnly /><Field label="이름" value={nickname} /><Field label="새 비밀번호" placeholder="새 비밀번호를 입력하세요" type="password" /><Field label="비밀번호 확인" placeholder="비밀번호를 다시 입력하세요" type="password" /></div><div className="mt-8 grid grid-cols-2 gap-3"><button type="button" onClick={onCancel} className="rounded-2xl bg-slate-100 py-4 font-bold text-slate-600">취소</button><button type="button" onClick={onCancel} className="rounded-2xl bg-slate-950 py-4 font-bold text-white">저장하기</button></div></div></section>; }

function Field({ label, value = "", placeholder, type = "text", readOnly = false }) { return <label className="block text-sm font-semibold text-slate-600">{label}<input type={type} defaultValue={value} placeholder={placeholder} readOnly={readOnly} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 outline-none focus:border-slate-900" /></label>; }

function AvatarTab({ gender, setGender, bodyType, setBodyType, height, weight }) { return <section className="grid gap-6 lg:grid-cols-[280px_1fr]"><aside className="rounded-3xl border border-slate-200 p-6"><div className="flex justify-between"><strong>내 아바타</strong><small className="text-slate-400">— {height}cm · {weight}kg</small></div><div className="mt-6"><AvatarFigure compact /></div><div className="mt-7 grid grid-cols-3 border-t pt-5 text-center text-sm"><span><small className="block text-slate-400">체형</small><b>{bodyType}</b></span><span className="border-x"><small className="block text-slate-400">키</small><b>{height}cm</b></span><span><small className="block text-slate-400">체중</small><b>{weight}kg</b></span></div></aside><div className="space-y-5"><section className="rounded-3xl border border-slate-200 p-8"><h1 className="text-2xl font-bold"><span className="mr-3 inline-flex size-8 items-center justify-center rounded-full bg-slate-950 text-base text-white">1</span>신체 정보 입력</h1><p className="mt-7 text-sm font-medium text-slate-600">성별 * (필수)</p><div className="mt-3 grid grid-cols-2 gap-4">{["남성", "여성"].map((value) => <button key={value} type="button" onClick={() => setGender(value)} className={`rounded-2xl border py-4 font-bold ${gender === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600"}`}>{value}</button>)}</div><div className="mt-6 grid grid-cols-2 gap-5"><Field label="↕ 키 (cm)" value={height} /><Field label="⚖ 몸무게 (kg)" value={weight} /></div><button type="button" className="mt-7 w-full rounded-2xl bg-slate-100 py-4 font-bold text-slate-600">체형 템플릿 생성하기 →</button></section><section className="rounded-3xl border border-slate-200 p-8"><h2 className="text-2xl font-bold"><span className="mr-3 inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-base text-slate-500">2</span>체형 선택</h2><div className="mt-7 grid grid-cols-3 gap-4">{[["상체형", "어깨·가슴이 발달한 체형"], ["하체형", "엉덩이·허벅지가 발달한 체형"], ["밸런스", "상·하체 균형 잡힌 체형"]].map(([title, description]) => <button key={title} type="button" onClick={() => setBodyType(title)} className={`rounded-3xl border p-6 text-center ${bodyType === title ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-100"}`}><Icon name="user" className="mx-auto size-12 text-slate-400" /><strong className="mt-3 block">{title}</strong><small className="mt-1 block text-slate-400">{description}</small></button>)}</div><p className="mt-5 text-center text-sm text-slate-400">선택하지 않으면 기본 체형(밸런스)으로 저장됩니다</p></section><button type="button" className="w-full rounded-2xl bg-slate-300 py-4 font-bold text-slate-600">✓ 아바타 저장하기</button></div></section>; }

function HistoryTab() { return <section className="mx-auto max-w-7xl"><div className="flex items-end justify-between"><div><h1 className="text-2xl font-bold">내 기록</h1><p className="mt-1 text-slate-400">지난 추천 · 결과 과정 · 패션 목록</p></div><small className="text-slate-400">총 3개 세션</small></div><div className="mt-8 space-y-5">{SESSIONS.map((session) => <article key={session.date} className="rounded-3xl border border-slate-100 p-6"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-bold text-white">같이 고르기</span><span className="text-lg text-slate-500">{session.date}</span></div><div className="flex items-center gap-5"><span className="text-right text-sm text-slate-500">예산<br /><b className="text-slate-900">{session.budget}</b></span><button type="button" className="rounded-full bg-slate-950 px-4 py-2 font-bold text-white">결과 보기</button></div></div><p className="mt-5 text-slate-500">카테고리: <b className="text-slate-900">{session.category}</b> · 고르기: <b className="text-slate-900">{session.count}개 확정</b></p><div className={`mt-5 grid gap-4 ${session.items.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>{session.items.map((item, index) => <div key={item} className="text-center"><ClothingPlaceholder rank={index + 1} /><p className="mt-3 font-medium text-slate-600">{item}</p></div>)}</div></article>)}</div></section>; }

function CollectionTab() { const [category, setCategory] = useState("전체"); const visible = category === "전체" ? SESSIONS.flatMap((session) => session.items.map((item) => [item, session.category])) : SESSIONS.filter((session) => session.category === category).flatMap((session) => session.items.map((item) => [item, session.category])); return <section className="mx-auto max-w-5xl"><div className="flex border-b">{["전체", "아우터", "상의", "하의"].map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={`border-b-2 px-5 py-4 font-bold ${category === value ? "border-slate-950" : "border-transparent text-slate-400"}`}>{value}</button>)}</div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(([item, itemCategory]) => <article key={item} className="overflow-hidden rounded-3xl bg-slate-50"><div className="relative"><span className="absolute left-3 top-3 rounded bg-white px-2 py-1 text-xs font-bold text-slate-500">{itemCategory}</span><ClothingPlaceholder /></div><p className="bg-white p-4 font-medium">{item}</p></article>)}</div></section>; }

function LogoutModal({ isPending, onCancel, onConfirm }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-lg rounded-4xl bg-white px-13 py-14 text-center shadow-2xl"><span className="mx-auto flex size-18 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon name="logout" className="size-9" /></span><h2 id="logout-title" className="mt-6 text-3xl font-bold">로그아웃</h2><p className="mt-3 text-lg text-slate-400">정말 로그아웃 하시겠습니까?</p><div className="mt-10 grid grid-cols-2 gap-4"><button type="button" onClick={onCancel} disabled={isPending} className="rounded-2xl bg-slate-100 py-4 text-lg font-bold text-slate-600">취소</button><button type="button" onClick={onConfirm} disabled={isPending} className="rounded-2xl bg-slate-950 py-4 text-lg font-bold text-white">{isPending ? "로그아웃 중..." : "로그아웃"}</button></div></section></div>; }

export default MyPage;
