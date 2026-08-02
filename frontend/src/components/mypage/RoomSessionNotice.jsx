import MyPageIcon from "@/components/mypage/MyPageIcon";

export default function RoomSessionNotice({ roomSession, onEnter, onClose }) {
    return (
        <aside className="fixed inset-x-4 bottom-5 z-20 mx-auto flex max-w-md items-center gap-4 rounded-3xl bg-slate-950 p-4 text-white shadow-2xl">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
                <MyPageIcon name="users" className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
                <small className="block text-amber-200">진행 중인 방</small>
                <strong className="block truncate">{roomSession.roomName ?? "참여 중인 의상 고르기 방"}</strong>
                <small className="text-slate-300">참여자 {roomSession.participantCount ?? 1}명 · 티어링크 진행 중</small>
            </span>
            <button type="button" onClick={onEnter} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-950">입장 →</button>
            <button type="button" onClick={onClose} aria-label="진행 중인 방 알림 닫기" className="text-lg text-slate-400 hover:text-white">×</button>
        </aside>
    );
}
