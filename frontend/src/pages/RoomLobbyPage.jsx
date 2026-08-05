import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import PageContainer from "@/components/common/PageContainer";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import { getApiErrorMessage } from "@/utils/apiError";

function RoomLobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isJoinFormOpen, setIsJoinFormOpen] = useState(false);
  const [joinForm, setJoinForm] = useState({
    roomCode: "",
    nickname: "",
  });

  const joinRoomMutation = useJoinRoom();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setJoinForm((current) => ({
      ...current,
      [name]: name === "roomCode" ? value.toUpperCase() : value,
    }));
  };

  const handleJoin = (event) => {
    event.preventDefault();
    joinRoomMutation.mutate({
      roomCode: joinForm.roomCode.trim(),
      nickname: joinForm.nickname.trim(),
    });
  };

  return (
    <main className="flex min-h-screen items-center bg-gray-50 py-12">
      <PageContainer>
        <section className="mx-auto max-w-2xl text-center">
          {location.state?.roomNotice && (
            <p className="mb-6 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              {location.state.roomNotice}
            </p>
          )}
          <p className="text-sm font-semibold text-brand-600">ROOM</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            어떻게 시작할까요?
          </h1>
          <p className="mt-4 text-slate-500">
            새로운 방을 만들거나 기존 방에 참여할 수 있어요.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate("/recommendation")}
              className="rounded-2xl bg-brand-600 px-6 py-8 text-lg font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:-translate-y-0.5 hover:bg-brand-500"
            >
              의상 추천받고 티어메이커 시작하기
            </button>
            <button
              type="button"
              onClick={() => setIsJoinFormOpen((current) => !current)}
              className="rounded-2xl border bg-white px-6 py-8 text-lg font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-600"
            >
              방 참여
            </button>
          </div>

          {isJoinFormOpen && (
            <form
              onSubmit={handleJoin}
              className="mt-6 rounded-3xl border bg-white p-6 text-left shadow-sm"
            >
              <h2 className="text-xl font-bold">방 코드로 참여하기</h2>
              <p className="mt-2 text-sm text-slate-500">
                비회원도 닉네임을 입력하면 참여할 수 있어요.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">방 코드</span>
                  <input
                    type="text"
                    name="roomCode"
                    value={joinForm.roomCode}
                    onChange={handleChange}
                    required
                    maxLength={6}
                    placeholder="A7K9Q2"
                    className="mt-2 w-full rounded-xl border px-4 py-3 uppercase outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">닉네임</span>
                  <input
                    type="text"
                    name="nickname"
                    value={joinForm.nickname}
                    onChange={handleChange}
                    required
                    placeholder="친구1"
                    className="mt-2 w-full rounded-xl border px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
                  />
                </label>
              </div>

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
                disabled={joinRoomMutation.isPending}
                className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joinRoomMutation.isPending ? "참여하는 중..." : "방 참여하기"}
              </button>
            </form>
          )}
        </section>
      </PageContainer>
    </main>
  );
}

export default RoomLobbyPage;
