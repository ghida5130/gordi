import { useState } from "react";
import { motion } from "motion/react";
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
    <main className="relative flex min-h-[calc(100vh-6rem)] items-center overflow-hidden py-12">

      <PageContainer className="relative">
        <motion.section
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto grid max-w-4xl grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.1)]"
        >
          <div className="relative flex min-h-[500px] flex-col overflow-hidden bg-violet-500 p-8 text-white">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 size-60 rounded-full bg-sky-300/40 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-20 -left-20 size-64 rounded-full bg-violet-900/30 blur-2xl"
            />

            <div className="relative mt-auto">
              <span className="flex size-13 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-[0_14px_30px_rgba(46,16,101,0.24)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="m16 11 2 2 4-4" />
                </svg>
              </span>
              <p className="mt-6 text-sm font-medium text-violet-100">
                초대받은 방 코드
              </p>
              <p className="mt-2 text-3xl font-black tracking-[0.18em]">
                {roomCode || "코드 없음"}
              </p>
              <p className="mt-5 text-sm leading-6 text-violet-100">
                닉네임을 입력하고 친구들과
                <br />
                실시간으로 스타일을 골라보세요.
              </p>
            </div>
          </div>

          <div className="flex min-h-[500px] flex-col justify-center p-10">
            <p className="text-xs font-bold tracking-[0.14em] text-violet-600">
              JOIN TOGETHER
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950">
              티어메이커 방에 초대됐어요
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              사용할 닉네임을 입력하면 바로 대기실로 이동합니다.
            </p>

            {roomCode ? (
              <form onSubmit={handleSubmit} className="mt-8">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    닉네임
                  </span>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    required
                    autoFocus
                    placeholder="친구1"
                    className="mt-2 h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 outline-none transition duration-200 placeholder:text-slate-300 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </label>

                {joinRoomMutation.isError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {getApiErrorMessage(
                      joinRoomMutation.error,
                      "방 참여에 실패했습니다.",
                    )}
                  </motion.p>
                )}

                <motion.button
                  type="submit"
                  disabled={!nickname.trim() || joinRoomMutation.isPending}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {joinRoomMutation.isPending
                    ? "참여하는 중..."
                    : "방 참여하기"}
                  {!joinRoomMutation.isPending && (
                    <span aria-hidden="true">→</span>
                  )}
                </motion.button>
              </form>
            ) : (
              <p className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                초대 링크에 방 코드가 없습니다.
              </p>
            )}

            <Link
              to="/rooms"
              className="mt-6 flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-violet-600"
            >
              <span aria-hidden="true">←</span>
              방 선택 화면으로 이동
            </Link>
          </div>
        </motion.section>
      </PageContainer>
    </main>
  );
}

export default RoomInvitePage;
