import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import PageContainer from "@/components/common/PageContainer";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import { getApiErrorMessage } from "@/utils/apiError";

function RoomInvitePage() {
  const { roomCode: roomCodeParam } = useParams();
  const roomCode = String(roomCodeParam ?? "").trim().toUpperCase();
  const [nickname, setNickname] = useState("");
  const joinRoomMutation = useJoinRoom();

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedNickname = nickname.trim();

    if (!roomCode || !trimmedNickname || joinRoomMutation.isPending) return;

    joinRoomMutation.mutate({
      roomCode,
      nickname: trimmedNickname,
    });
  };

  return (
    <main className="flex min-h-screen items-center bg-gray-50 py-12">
      <PageContainer>
        <section className="mx-auto max-w-lg rounded-3xl border bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9">
          <p className="text-sm font-semibold text-brand-600">ROOM INVITE</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            티어메이커 방에 초대됐어요
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            사용할 닉네임을 입력하면 바로 대기실로 이동합니다.
          </p>

          <div className="mt-7 rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs text-slate-400">초대받은 방 코드</p>
            <p className="mt-1 text-xl font-bold tracking-[0.2em]">
              {roomCode || "코드 없음"}
            </p>
          </div>

          {roomCode ? (
            <form onSubmit={handleSubmit} className="mt-6">
              <label className="block">
                <span className="text-sm font-medium">닉네임</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                  autoFocus
                  placeholder="친구1"
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
                />
              </label>

              {joinRoomMutation.isError && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {getApiErrorMessage(
                    joinRoomMutation.error,
                    "방 참여에 실패했습니다.",
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={!nickname.trim() || joinRoomMutation.isPending}
                className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-3.5 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joinRoomMutation.isPending
                  ? "참여하는 중..."
                  : "방 참여하기"}
              </button>
            </form>
          ) : (
            <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              초대 링크에 방 코드가 없습니다.
            </p>
          )}

          <Link
            to="/rooms"
            className="mt-6 block text-center text-sm font-semibold text-slate-500 hover:text-brand-600"
          >
            방 선택 화면으로 이동
          </Link>
        </section>
      </PageContainer>
    </main>
  );
}

export default RoomInvitePage;
