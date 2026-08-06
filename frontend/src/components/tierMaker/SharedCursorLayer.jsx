import { useEffect, useState } from "react";

import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";
import { TIER_MAKER_CURSOR_ANCHOR_SELECTOR } from "@/utils/tierMakerCursor";

const cursorColors = [
  {
    background: "bg-violet-600",
    text: "text-violet-600",
  },
  {
    background: "bg-blue-600",
    text: "text-blue-600",
  },
  {
    background: "bg-rose-500",
    text: "text-rose-500",
  },
  {
    background: "bg-amber-500",
    text: "text-amber-500",
  },
];

function getParticipantIndex(participants, participantId) {
  const index = participants.findIndex(
    (participant) =>
      String(participant.participantId) === String(participantId),
  );

  return index >= 0 ? index : Number(participantId) || 0;
}

function SharedCursorLayer({
  cursors,
  participants,
  currentParticipantId,
  itemLocks,
  clothesById,
  boardRef,
  layoutKey,
  resolveCursorPosition,
}) {
  const [, setLayoutRevision] = useState(0);

  useEffect(() => {
    const board = boardRef?.current;

    if (!board) return undefined;

    let scheduledFrame = null;
    let animationFrame = null;
    let animationUntil = performance.now() + 550;
    const refreshLayout = () => {
      if (scheduledFrame !== null) return;

      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = null;
        setLayoutRevision((current) => current + 1);
      });
    };
    const resizeObserver = new ResizeObserver(refreshLayout);
    const followLayoutAnimation = (timestamp) => {
      refreshLayout();

      if (timestamp < animationUntil) {
        animationFrame = window.requestAnimationFrame(followLayoutAnimation);
        return;
      }

      animationFrame = null;
    };
    const followFor = (duration) => {
      animationUntil = Math.max(animationUntil, performance.now() + duration);

      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(followLayoutAnimation);
      }
    };
    const observeAnchors = () => {
      board
        .querySelectorAll(TIER_MAKER_CURSOR_ANCHOR_SELECTOR)
        .forEach((element) => resizeObserver.observe(element));
    };
    const mutationObserver = new MutationObserver(() => {
      observeAnchors();
      followFor(320);
    });

    resizeObserver.observe(board);
    observeAnchors();
    mutationObserver.observe(board, { childList: true, subtree: true });
    followFor(550);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();

      if (scheduledFrame !== null) {
        window.cancelAnimationFrame(scheduledFrame);
      }

      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [boardRef, layoutKey]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden rounded-3xl">
      {Object.values(cursors).map((cursor) => {
        const position = resolveCursorPosition
          ? resolveCursorPosition(cursor)
          : cursor;

        if (!position) return null;

        const isCurrentParticipant =
          String(cursor.participantId) === String(currentParticipantId);
        const participant = participants.find(
          (currentParticipant) =>
            String(currentParticipant.participantId) ===
            String(cursor.participantId),
        );
        const color =
          cursorColors[
            getParticipantIndex(participants, cursor.participantId) %
              cursorColors.length
          ];
        const activeLock = Object.values(itemLocks).find(
          (lock) =>
            String(lock.ownerParticipantId) ===
            String(cursor.participantId),
        );
        const draggedItem = activeLock
          ? clothesById[String(activeLock.roomItemId)]
          : null;

        return (
          <div
            key={cursor.participantId}
            className="absolute"
            style={{
              left: `${position.x * 100}%`,
              top: `${position.y * 100}%`,
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`block size-7 overflow-visible drop-shadow-[0_3px_4px_rgba(15,23,42,0.22)] ${color.text}`}
            >
              <path
                d="M2.35 2.72c-.32-1.04.77-1.88 1.7-1.3l15.5 9.55c.95.58.67 2.02-.43 2.2l-5.6.9a2 2 0 0 0-1.5 1.12l-2.4 5.1c-.47 1-1.93.9-2.26-.15L2.35 2.72Z"
                fill="currentColor"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className={`ml-4 -mt-0.5 block w-fit max-w-28 truncate rounded-full px-2.5 py-1 text-[10px] tracking-tight text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)] ring-2 ring-white/90 ${isCurrentParticipant ? "font-bold" : "font-normal"} ${color.background}`}
            >
              {isCurrentParticipant
                ? "나"
                : participant?.nickname ?? `참여자 ${cursor.participantId}`}
            </span>
            {draggedItem && (
              <div className="ml-4 mt-2 w-16 rounded-xl border-2 border-white bg-white p-1 shadow-xl">
                <ClothingArtwork
                  item={draggedItem}
                  className="aspect-square w-full rounded-lg"
                />
                <p className="mt-1 truncate px-1 text-[9px] font-bold text-slate-700">
                  {draggedItem.name}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SharedCursorLayer;
