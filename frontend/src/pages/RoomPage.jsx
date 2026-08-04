import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  CONNECTING: "연결 중",
  CONNECTED: "연결됨",
  DISCONNECTED: "연결 끊김",
  ERROR: "연결 오류",
};

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
      <main className="flex min-h-screen items-center bg-slate-100 py-12">
        <PageContainer>
          <section className="mx-auto max-w-md rounded-3xl border bg-white p-8 text-center shadow-xl shadow-slate-200/70">
            <h1 className="text-2xl font-bold">방 참여 정보가 없습니다</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              방을 만들거나 방 코드를 이용해 먼저 참여해 주세요.
            </p>
            <Link
              to="/rooms"
              className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white"
            >
              방 선택으로 이동
            </Link>
          </section>
        </PageContainer>
      </main>
    );
  }

  const maxParticipants = roomSession.maxParticipants ?? 4;

  return (
    <main className="min-h-screen bg-slate-100 py-10">
      <PageContainer>
        <header className="flex flex-col gap-5 rounded-3xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-600">
              WAITING ROOM
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              참여자를 기다리고 있어요
            </h1>
          </div>

          <div className="min-w-72 rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs text-slate-400">방 코드</p>
            <div className="mt-1">
              <strong className="text-xl tracking-[0.2em]">
                {roomSession.roomCode ?? "코드 없음"}
              </strong>
              {roomSession.roomCode && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyRoomCode}
                    className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-white/20 hover:text-white"
                  >
                    {copiedTarget === "code" ? "코드 복사됨" : "방 코드 복사"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="flex-1 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
                  >
                    {copiedTarget === "link" ? "링크 복사됨" : "초대 링크 복사"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">참여자 현황</h2>
              <p className="mt-1 text-sm text-slate-500">
                {participants.length}/{maxParticipants}명 참여 중
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                connectionState === "CONNECTED"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              WebSocket {CONNECTION_LABELS[connectionState]}
            </span>
          </div>

          {(connectionError || roomStatusQuery.isError) && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {connectionError ||
                getApiErrorMessage(
                  roomStatusQuery.error,
                  "방 상태를 불러오지 못했습니다.",
                )}
            </p>
          )}

          {/* 참여자 입퇴장 이벤트를 반영하는 대기실 목록 */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: maxParticipants }, (_, index) => {
              const participant = participants[index];

              return participant ? (
                <article
                  key={participant.participantId}
                  className="rounded-2xl border border-brand-500/20 bg-brand-50 p-5"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                    {(participant.nickname ?? "?").slice(0, 1)}
                  </div>
                  <p className="mt-4 truncate font-semibold">
                    {participant.nickname ?? "이름 없음"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-brand-600">
                    {participant.role === "HOST" ? "방장" : "참여자"}
                  </p>
                </article>
              ) : (
                <article
                  key={`empty-${index}`}
                  className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed bg-slate-50 text-sm text-slate-400"
                >
                  참여자 대기 중
                </article>
              );
            })}
          </div>

          {roomSession.role === "HOST" ? (
            <button
              type="button"
              onClick={handleStartRoom}
              disabled={
                connectionState !== "CONNECTED" ||
                !hasSnapshot ||
                roomStatusQuery.isPending ||
                isStartRequested
              }
              className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStartRequested
                ? "방을 시작하는 중..."
                : hasSnapshot
                  ? "티어메이킹 시작"
                  : "방 상태 확인 중..."}
            </button>
          ) : (
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
              방장이 티어메이킹을 시작할 때까지 기다려 주세요.
            </p>
          )}
        </section>
      </PageContainer>
    </main>
  );
}

export default RoomPage;
