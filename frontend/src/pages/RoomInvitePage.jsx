import { useState } from "react";
import { motion } from "motion/react";
import { useParams } from "react-router-dom";

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
          className="mx-auto max-w-xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.1)]"
        >
          <div className="flex min-h-[480px] flex-col justify-center p-10">
            <h1 className="text-3xl font-black tracking-[-0.035em] text-slate-950">
              티어메이커 방에 초대됐어요
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              사용할 닉네임을 입력하면 바로 대기실로 이동합니다.
            </p>
            <div className="mt-5 flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-600">
              <span className="text-slate-400">방 코드</span>
              <span className="tracking-[0.12em]">
                {roomCode || "코드 없음"}
              </span>
            </div>

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

          </div>
        </motion.section>
      </PageContainer>
    </main>
  );
}

export default RoomInvitePage;
