import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getRoomStatus } from "@/api/rooms";
import PageContainer from "@/components/common/PageContainer";
import { useRoomEvents } from "@/hooks/useRoomEvents";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  getRoomSession,
  removeRoomSession,
} from "@/utils/roomSessionStorage";

const CONNECTION_LABELS = {
  CONNECTING: "실시간 연결 중",
  CONNECTED: "실시간 연결됨",
  DISCONNECTED: "실시간 연결 끊김",
  ERROR: "실시간 연결 오류",
};

const CONNECTION_STYLES = {
  CONNECTING: "border-amber-200 bg-amber-50 text-amber-700",
  CONNECTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DISCONNECTED: "border-slate-200 bg-slate-100 text-slate-600",
  ERROR: "border-red-200 bg-red-50 text-red-700",
};

const PARTICIPANT_STYLES = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [roomSession] = useState(getRoomSession);
  const [copiedTarget, setCopiedTarget] = useState(null);
  const [isStartRequested, setIsStartRequested] = useState(false);
  const isCurrentRoom =
    roomSession && String(roomSession.roomId) === String(roomId);
  const {
    participants,
    status,
    hasSnapshot,
    terminalEvent,
    connectionState,
    connectionError,
    startRoom,
    applyRoomStatus,
    requestSync,
  } = useRoomEvents(isCurrentRoom ? roomSession : null);
  const roomStatusQuery = useQuery({
    queryKey: ["roomStatus", roomSession?.roomCode],
    queryFn: () =>
      getRoomStatus({
        roomCode: roomSession.roomCode,
        roomToken: roomSession.roomToken,
      }),
    enabled:
      Boolean(isCurrentRoom) &&
      Boolean(roomSession?.roomCode) &&
      Boolean(roomSession?.roomToken) &&
      connectionState === "CONNECTED",
    staleTime: 0,
  });

  useEffect(() => {
    const roomStatus = roomStatusQuery.data?.data;

    if (roomStatus) {
      applyRoomStatus(roomStatus);
    }
  }, [applyRoomStatus, roomStatusQuery.data]);

  useEffect(() => {
    if (
      connectionState === "CONNECTED" &&
      roomStatusQuery.isFetched &&
      !roomStatusQuery.isFetching
    ) {
      requestSync();
    }
  }, [
    connectionState,
    requestSync,
    roomStatusQuery.isFetched,
    roomStatusQuery.isFetching,
  ]);

  useEffect(() => {
    if (status === "IN_PROGRESS") {
      navigate(`/rooms/${roomId}/tier-maker`, { replace: true });
    }
  }, [navigate, roomId, status]);

  useEffect(() => {
    if (!terminalEvent) return;

    removeRoomSession();
    navigate("/rooms", {
      replace: true,
      state: {
        roomNotice:
          terminalEvent === "ROOM_EXPIRED"
            ? "방 이용 시간이 만료되었습니다."
            : "방이 종료되었습니다.",
      },
    });
  }, [navigate, terminalEvent]);

  useEffect(() => {
    if (!isStartRequested) return undefined;

    const resetTimer = window.setTimeout(() => {
      setIsStartRequested(false);
    }, 5_000);

    return () => window.clearTimeout(resetTimer);
  }, [isStartRequested]);

  const handleCopyRoomCode = async () => {
    if (!roomSession?.roomCode) return;

    await navigator.clipboard.writeText(roomSession.roomCode);
    setCopiedTarget("code");
  };

  const handleCopyInviteLink = async () => {
    if (!roomSession?.roomCode) return;

    const inviteLink = new URL(
      `/rooms/join/${encodeURIComponent(roomSession.roomCode)}`,
      window.location.origin,
    ).toString();

    await navigator.clipboard.writeText(inviteLink);
    setCopiedTarget("link");
  };

  const handleStartRoom = () => {
    const clientEventId = startRoom();

    if (clientEventId) {
      setIsStartRequested(true);
    }
  };

  if (!isCurrentRoom) {
    return (
      <main className="relative flex min-h-[calc(100vh-6rem)] items-center overflow-hidden py-12">
        <PageContainer className="relative">
          <motion.section
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-9 text-center shadow-[0_22px_65px_rgba(15,23,42,0.1)]"
          >
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-7"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6M22 11h-6" />
              </svg>
            </span>
            <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
              방 참여 정보가 없습니다
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              방을 만들거나 초대받은 방 코드로 먼저 참여해 주세요.
            </p>
            <Link
              to="/rooms"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-950 px-6 font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              방 선택으로 이동
              <span aria-hidden="true">→</span>
            </Link>
          </motion.section>
        </PageContainer>
      </main>
    );
  }

  const maxParticipants = roomSession.maxParticipants ?? 4;

  return (
    <main className="relative min-h-[calc(100vh-6rem)] overflow-hidden py-10">

      <PageContainer className="relative">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-[minmax(0,1fr)_360px] gap-6 rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_16px_50px_rgba(15,23,42,0.07)]"
        >
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-black tracking-[-0.035em] text-slate-950">
              참여자를 기다리고 있어요
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
              초대 링크를 공유하고 모두 모이면 함께 티어메이킹을 시작하세요.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[22px] bg-slate-950 p-5 text-white shadow-[0_16px_38px_rgba(15,23,42,0.2)]">
            <span
              aria-hidden="true"
              className="absolute -right-6 -top-8 size-28 rounded-full bg-violet-500/40 blur-2xl"
            />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">방 코드</p>
                <strong className="mt-1.5 block text-2xl tracking-[0.2em]">
                  {roomSession.roomCode ?? "코드 없음"}
                </strong>
              </div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-violet-200">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                  aria-hidden="true"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </span>
            </div>
            {roomSession.roomCode && (
              <div className="relative mt-5 grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  onClick={handleCopyRoomCode}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/15 hover:text-white"
                >
                  {copiedTarget === "code" ? "코드 복사됨" : "방 코드 복사"}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleCopyInviteLink}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-xl bg-violet-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
                >
                  {copiedTarget === "link" ? "링크 복사됨" : "초대 링크 복사"}
                </motion.button>
              </div>
            )}
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-950">참여자 현황</h2>
                <p className="mt-1 text-sm text-slate-500">
                  <strong className="font-bold text-slate-800">
                    {participants.length}
                  </strong>
                  /{maxParticipants}명 참여 중
                </p>
              </div>
            </div>
            <span
              aria-live="polite"
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${
                CONNECTION_STYLES[connectionState] ?? CONNECTION_STYLES.DISCONNECTED
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  connectionState === "CONNECTED"
                    ? "bg-emerald-500"
                    : connectionState === "ERROR"
                      ? "bg-red-500"
                      : "bg-amber-500"
                }`}
              />
              {CONNECTION_LABELS[connectionState] ?? "연결 상태 확인 중"}
            </span>
          </div>

          {(connectionError || roomStatusQuery.isError) && (
            <p className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {connectionError ||
                getApiErrorMessage(
                  roomStatusQuery.error,
                  "방 상태를 불러오지 못했습니다.",
                )}
            </p>
          )}

          {/* 참여자 입퇴장 이벤트를 반영하는 대기실 목록 */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <AnimatePresence initial={false} mode="popLayout">
              {Array.from({ length: maxParticipants }, (_, index) => {
                const participant = participants[index];

                return participant ? (
                  <motion.article
                    layout
                    key={participant.participantId}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="group relative min-h-40 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_15px_34px_rgba(15,23,42,0.09)]"
                  >
                    <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      접속 중
                    </span>
                    <div
                      className={`flex size-12 items-center justify-center rounded-2xl text-lg font-black ${
                        PARTICIPANT_STYLES[index % PARTICIPANT_STYLES.length]
                      }`}
                    >
                      {(participant.nickname ?? "?").slice(0, 1)}
                    </div>
                    <p className="mt-5 truncate font-bold text-slate-950">
                      {participant.nickname ?? "이름 없음"}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        participant.role === "HOST"
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {participant.role === "HOST" ? "방장" : "게스트"}
                    </span>
                  </motion.article>
                ) : (
                  <motion.article
                    layout
                    key={`empty-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-40 flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 text-sm text-slate-400"
                  >
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-5"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                    <span className="mt-3 font-medium">참여자 대기 중</span>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>

          {roomSession.role === "HOST" ? (
            <motion.button
              type="button"
              onClick={handleStartRoom}
              disabled={
                connectionState !== "CONNECTED" ||
                !hasSnapshot ||
                roomStatusQuery.isPending ||
                isStartRequested
              }
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.995 }}
              className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStartRequested
                ? "방을 시작하는 중..."
                : hasSnapshot
                  ? "티어메이킹 시작"
                  : "방 상태 확인 중..."}
              {!isStartRequested && hasSnapshot && (
                <span aria-hidden="true">→</span>
              )}
            </motion.button>
          ) : (
            <p className="mt-6 flex h-13 items-center justify-center gap-2 rounded-2xl bg-violet-50 px-4 text-center text-sm font-medium text-violet-700">
              <span className="size-2 animate-pulse rounded-full bg-violet-500" />
              방장이 티어메이킹을 시작할 때까지 기다려 주세요.
            </p>
          )}
        </motion.section>
      </PageContainer>
    </main>
  );
}

export default RoomPage;
