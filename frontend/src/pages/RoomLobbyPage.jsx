import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";

import arrowImage from "@/assets/images/arrow.svg";
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
    <main className="relative flex min-h-[calc(100vh-6rem)] items-center overflow-hidden py-12">
      <PageContainer className="relative">
        <section className="mx-auto max-w-5xl">
          <AnimatePresence>
            {location.state?.roomNotice && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(15,23,42,0.16)]"
              >
                <span className="size-2 rounded-full bg-sky-400" />
                {location.state.roomNotice}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-10 shadow-[0_20px_65px_rgba(15,23,42,0.08)]"
          >
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950">
                어떻게 시작할까요?
              </h1>
              <p className="mt-3 text-base text-slate-500">
                새로운 스타일을 추천받거나, 초대받은 방에 바로 참여해 보세요.
              </p>
            </div>

            <div className="mt-9 grid grid-cols-2 gap-4 text-left">
              <motion.button
                type="button"
                onClick={() => navigate("/recommendation")}
                className="group relative flex min-h-[250px] transform-gpu flex-col justify-between overflow-hidden rounded-[24px] bg-violet-500 p-7 text-left text-white shadow-[0_18px_40px_rgba(139,92,246,0.22)] outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[0.97] hover:shadow-[0_10px_24px_rgba(139,92,246,0.18)] focus-visible:scale-[0.97] focus-visible:ring-4 focus-visible:ring-violet-200 active:scale-[0.95]"
              >
                <span className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-full border border-white/40 bg-white/15 text-xl">
                  ↗
                </span>
                <span className="relative flex size-24 -rotate-3 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-[0_22px_42px_-12px_rgba(109,40,217,0.48),0_6px_14px_-6px_rgba(109,40,217,0.28)] transition-transform duration-500 group-hover:-rotate-1">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-11"
                    aria-hidden="true"
                  >
                    <path d="M12 10a3 3 0 1 0-3-3" />
                    <path d="M12 10 3 16.2A1.6 1.6 0 0 0 4 19h16a1.6 1.6 0 0 0 1-2.8L12 10Z" />
                  </svg>
                </span>
                <strong className="relative mt-8 block max-w-xs text-2xl font-bold leading-tight tracking-tight">
                  의상을 추천받고
                  <br />
                  티어메이커 시작하기
                </strong>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setIsJoinFormOpen((current) => !current)}
                aria-expanded={isJoinFormOpen}
                className="group relative flex min-h-[250px] transform-gpu flex-col justify-between overflow-hidden rounded-[24px] bg-sky-400 p-7 text-left text-white shadow-[0_18px_40px_rgba(14,165,233,0.2)] outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[0.97] hover:shadow-[0_10px_24px_rgba(14,165,233,0.18)] focus-visible:scale-[0.97] focus-visible:ring-4 focus-visible:ring-sky-200 active:scale-[0.95]"
              >
                <span className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-full border border-white/40 bg-white/15">
                  <img
                    src={arrowImage}
                    alt=""
                    aria-hidden="true"
                    className={`size-5 object-contain brightness-0 invert transition-transform duration-300 ${isJoinFormOpen ? "rotate-180" : ""}`}
                  />
                </span>
                <span className="relative flex size-24 -rotate-3 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-[0_22px_42px_-12px_rgba(3,105,161,0.48),0_6px_14px_-6px_rgba(3,105,161,0.28)] transition-transform duration-500 group-hover:-rotate-1">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-11"
                    aria-hidden="true"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M19 8v6M22 11h-6" />
                  </svg>
                </span>
                <span className="relative mt-8 block">
                  <strong className="block text-2xl font-bold tracking-tight">
                    방 코드로 참여하기
                  </strong>
                  <span className="mt-2 block text-sm text-white/75">
                    초대받은 코드와 닉네임만 있으면 돼요.
                  </span>
                </span>
              </motion.button>
            </div>

            <AnimatePresence initial={false}>
              {isJoinFormOpen && (
                <motion.form
                  onSubmit={handleJoin}
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/80 p-6 text-left">
                    <div className="flex items-end justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-slate-950">
                          방 코드로 참여하기
                        </h2>
                        <p className="mt-1.5 text-sm text-slate-500">
                          비회원도 닉네임을 입력하면 참여할 수 있어요.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          방 코드
                        </span>
                        <input
                          type="text"
                          name="roomCode"
                          value={joinForm.roomCode}
                          onChange={handleChange}
                          required
                          maxLength={6}
                          placeholder="A7K9Q2"
                          className="mt-2 h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 uppercase text-slate-950 outline-none transition duration-200 placeholder:text-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          닉네임
                        </span>
                        <input
                          type="text"
                          name="nickname"
                          value={joinForm.nickname}
                          onChange={handleChange}
                          required
                          placeholder="친구1"
                          className="mt-2 h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none transition duration-200 placeholder:text-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        />
                      </label>
                    </div>

                    {joinRoomMutation.isError && (
                      <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {getApiErrorMessage(
                          joinRoomMutation.error,
                          "방 참여에 실패했습니다.",
                        )}
                      </p>
                    )}

                    <motion.button
                      type="submit"
                      disabled={joinRoomMutation.isPending}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {joinRoomMutation.isPending
                        ? "참여하는 중..."
                        : "방 참여하기"}
                      {!joinRoomMutation.isPending && (
                        <span aria-hidden="true">→</span>
                      )}
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </section>
      </PageContainer>
    </main>
  );
}

export default RoomLobbyPage;
