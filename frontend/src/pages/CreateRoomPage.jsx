import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { createRoom } from "@/api/rooms";
import PageContainer from "@/components/common/PageContainer";
import { getApiErrorMessage } from "@/utils/apiError";
import { setRoomSession } from "@/utils/roomSessionStorage";
import { getAccessToken } from "@/utils/tokenStorage";

const MAX_PARTICIPANTS = 4;

function CreateRoomPage() {
  const navigate = useNavigate();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [form, setForm] = useState({
    recommendationId: "21",
    recommendationVersion: "2",
  });
  const isLoggedIn = Boolean(getAccessToken());

  const createRoomMutation = useMutation({
    mutationFn: (roomInformation) =>
      createRoom(roomInformation, idempotencyKey.current),
    onSuccess: (response) => {
      // 생성 응답을 방 범위 세션으로 저장 후 방 페이지 이동
      setRoomSession({
        ...response.data,
        role: "HOST",
        nickname: "방장",
      });
      navigate(`/rooms/${response.data.roomId}`, { replace: true });
    },
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    createRoomMutation.mutate({
      recommendationId: Number(form.recommendationId),
      recommendationVersion: Number(form.recommendationVersion),
      maxParticipants: MAX_PARTICIPANTS,
    });
  };

  return (
    <main className="min-h-screen bg-slate-100 py-12">
      <PageContainer>
        <section className="mx-auto max-w-lg rounded-3xl border bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9">
          <Link
            to="/rooms"
            className="text-sm font-semibold text-slate-500 hover:text-brand-600"
          >
            ← 방 선택으로 돌아가기
          </Link>

          <p className="mt-8 text-sm font-semibold text-brand-600">
            CREATE ROOM
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            새로운 방 만들기
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            방 생성이 완료되면 방장으로 자동 참여합니다.
          </p>

          {!isLoggedIn ? (
            <div className="mt-8 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">
              <p className="font-semibold">방 생성에는 로그인이 필요합니다.</p>
              <Link
                to="/"
                className="mt-3 inline-block font-semibold underline"
              >
                로그인하러 가기
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-medium">추천 ID</span>
                <input
                  type="number"
                  name="recommendationId"
                  value={form.recommendationId}
                  onChange={handleChange}
                  min="1"
                  required
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">추천 버전</span>
                <input
                  type="number"
                  name="recommendationVersion"
                  value={form.recommendationVersion}
                  onChange={handleChange}
                  min="1"
                  required
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10"
                />
              </label>

              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">
                  최대 참여 인원
                </p>
                <p className="mt-1 font-semibold">4명</p>
              </div>

              {createRoomMutation.isError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {getApiErrorMessage(
                    createRoomMutation.error,
                    "방 생성에 실패했습니다.",
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={createRoomMutation.isPending}
                className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createRoomMutation.isPending
                  ? "방을 만드는 중..."
                  : "방 만들기"}
              </button>
            </form>
          )}
        </section>
      </PageContainer>
    </main>
  );
}

export default CreateRoomPage;
