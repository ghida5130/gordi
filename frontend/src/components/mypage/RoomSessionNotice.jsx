import { useEffect, useState } from "react";
import MyPageIcon from "@/components/mypage/MyPageIcon";

const EXIT_DURATION = 260;

export default function RoomSessionNotice({
  activeRoom,
  onEnter,
  onClose,
  isEntering = false,
}) {
  const [isExiting, setIsExiting] = useState(false);
  const isWaiting = activeRoom.status === "WAITING";

  useEffect(() => {
    if (!isExiting) return undefined;

    const timer = window.setTimeout(onClose, EXIT_DURATION);
    return () => window.clearTimeout(timer);
  }, [isExiting, onClose]);

  return (
    <>
      <style>
        {`
                    @keyframes roomSessionNoticeRise {
                        from {
                            opacity: 0;
                            transform: translateY(320px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    @keyframes roomSessionNoticeExpand {
                        from {
                            width: 60px;
                        }
                        to {
                            width: 100%;
                        }
                    }

                    @keyframes roomSessionNoticeContentReveal {
                        from {
                            opacity: 0;
                        }
                        to {
                            opacity: 1;
                        }
                    }

                    @keyframes roomSessionNoticeExit {
                        from {
                            opacity: 1;
                            transform: translateY(0);
                        }
                        to {
                            opacity: 0;
                            transform: translateY(18px);
                        }
                    }

                    .room-session-notice {
                        background: rgba(201, 201, 201, 0.651);
                        backdrop-filter: blur(28px) saturate(180%);
                        -webkit-backdrop-filter: blur(28px) saturate(180%);
                        animation:
                            roomSessionNoticeRise 700ms cubic-bezier(0.16, 1, 0.3, 1) both,
                            roomSessionNoticeExpand 400ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
                        transform-origin: bottom center;
                    }

                    .room-session-notice-content {
                        animation: roomSessionNoticeContentReveal 280ms 250ms ease-out both;
                    }

                    .room-session-notice.room-session-notice-exiting {
                        width: 100%;
                        animation: roomSessionNoticeExit ${EXIT_DURATION}ms ease-in forwards;
                    }

                    @media (prefers-reduced-motion: reduce) {
                        .room-session-notice,
                        .room-session-notice-content {
                            animation: none;
                        }
                    }
                `}
      </style>
      <div className="pointer-events-none fixed inset-x-4 bottom-6 z-20 mx-auto flex max-w-md justify-center">
        <aside
          className={`room-session-notice pointer-events-auto relative min-h-18 overflow-hidden rounded-full border border-white/75 text-gray-950 shadow-lg ${isExiting ? "room-session-notice-exiting" : ""}`}
          aria-label="진행 중인 방"
        >
          <div className="room-session-notice-content flex min-h-18 w-[min(calc(100vw-2rem),28rem)] items-center gap-3 px-5 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/45 text-gray-700 ring-1 ring-white/70">
              <MyPageIcon name="users" className="size-5" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <small className="mb-0.5 flex items-center gap-2 font-semibold text-amber-800">
                <span
                  className="size-2 rounded-full bg-amber-500 ring-3 ring-amber-100/80"
                  aria-hidden="true"
                />
                {isWaiting ? "대기 중인 방" : "진행 중인 방"}
              </small>
              <strong className="block truncate text-sm">
                티어메이커 방 {activeRoom.roomCode}
              </strong>
              <small className="block truncate text-gray-600">
                {activeRoom.role === "HOST" ? "방장" : "참여자"} ·{" "}
                {isWaiting ? "시작 대기 중" : "티어메이커 진행 중"}
              </small>
            </span>
            <button
              type="button"
              onClick={onEnter}
              disabled={isEntering}
              className="shrink-0 rounded-full bg-gray-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
            >
              {isEntering ? "재입장 중..." : "입장"}
            </button>
            <button
              type="button"
              onClick={() => setIsExiting(true)}
              disabled={isExiting || isEntering}
              aria-label="진행 중인 방 알림 닫기"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-gray-600 transition-colors hover:bg-white/40 hover:text-gray-950"
            >
              ×
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
