import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";

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
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden rounded-3xl">
      {Object.values(cursors)
        .filter(
          (cursor) =>
            String(cursor.participantId) !==
            String(currentParticipantId),
        )
        .map((cursor) => {
          const participant = participants.find(
            (currentParticipant) =>
              String(currentParticipant.participantId) ===
              String(cursor.participantId),
          );
          const color =
            cursorColors[
              getParticipantIndex(
                participants,
                cursor.participantId,
              ) % cursorColors.length
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
                left: `${cursor.x * 100}%`,
                top: `${cursor.y * 100}%`,
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className={`block size-6 overflow-visible drop-shadow-sm ${color.text}`}
              >
                <path
                  d="M0 0 19.5 13.2l-7.7 1.3-4.2 8L0 0Z"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className={`ml-3 -mt-1 block max-w-28 truncate rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-sm ${color.background}`}
              >
                {participant?.nickname ??
                  `참여자 ${cursor.participantId}`}
              </span>
              {draggedItem && (
                <div className="ml-4 mt-1 w-16 rounded-xl border-2 border-white bg-white p-1 shadow-xl">
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
