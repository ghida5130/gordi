import { useMemo, useState } from "react";

import ClothingCatalog from "@/components/tierMaker/ClothingCatalog";
import FittingPanel from "@/components/tierMaker/FittingPanel";
import ParticipantDock from "@/components/tierMaker/ParticipantDock";
import SharedCursorLayer from "@/components/tierMaker/SharedCursorLayer";
import TierBoard from "@/components/tierMaker/TierBoard";
import TierMakerIcon from "@/components/tierMaker/TierMakerIcon";
import {
  designCandidatesResponse,
  designProductResponses,
  designRoomStatusResponse,
} from "@/data/tierMakerDesignData";
import { createTierMakerClothing } from "@/utils/tierMakerClothing";

const roomStatus = designRoomStatusResponse.data;
const candidateItems = designCandidatesResponse.data.items;
const initialTiers = roomStatus.tiers.map((tier) => ({ ...tier }));
const initialPlacements = candidateItems.map((item) => ({
  roomItemId: item.roomItemId,
  tierId: item.tierId,
  position: item.position,
}));
const clothes = candidateItems.map((roomItem) =>
  createTierMakerClothing(
    roomItem,
    designProductResponses[roomItem.productId]?.data,
  ),
);
const clothesById = Object.fromEntries(
  clothes.map((item) => [item.id, item]),
);
const designCursors = {
  2: {
    participantId: 2,
    x: 0.67,
    y: 0.24,
  },
};
const emptyItemLocks = {};
const noOp = () => {};
const emptyTryOn = {
  status: "IDLE",
  jobId: null,
  resultImageUrl: "",
  reason: "",
};

function movePlacement(
  currentPlacements,
  itemId,
  targetTierId,
  requestedIndex,
) {
  const placementsWithoutItem = currentPlacements.filter(
    (placement) => String(placement.roomItemId) !== String(itemId),
  );
  const targetPlacements = placementsWithoutItem
    .filter((placement) => placement.tierId === targetTierId)
    .sort((left, right) => left.position - right.position);
  const nextIndex = Math.max(
    0,
    Math.min(requestedIndex ?? targetPlacements.length, targetPlacements.length),
  );

  targetPlacements.splice(nextIndex, 0, {
    roomItemId: Number(itemId),
    tierId: targetTierId,
    position: 0,
  });

  return [
    ...placementsWithoutItem.filter(
      (placement) => placement.tierId !== targetTierId,
    ),
    ...targetPlacements.map((placement, index) => ({
      ...placement,
      position: (index + 1) * 10_000,
    })),
  ];
}

function TierMakerDesignPage() {
  const [tierDefinitions, setTierDefinitions] = useState(initialTiers);
  const [placements, setPlacements] = useState(initialPlacements);
  const [fittingCandidates, setFittingCandidates] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const tiers = useMemo(
    () =>
      [...tierDefinitions]
        .sort((left, right) => left.position - right.position)
        .map((tier) => ({
          id: String(tier.tierId),
          tierId: tier.tierId,
          name: tier.name,
          itemIds: [...placements]
            .filter((placement) => placement.tierId === tier.tierId)
            .sort((left, right) => left.position - right.position)
            .map((placement) => String(placement.roomItemId)),
        })),
    [placements, tierDefinitions],
  );
  const tierByItem = useMemo(
    () =>
      Object.fromEntries(
        tiers.flatMap((tier) =>
          tier.itemIds.map((itemId) => [itemId, tier.name]),
        ),
      ),
    [tiers],
  );
  const selectedClothes = fittingCandidates
    .map((itemId) => clothesById[itemId])
    .filter(Boolean);

  const handleDragStart = (event, itemId) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  };

  const handleDropTier = (itemId, targetTierId, requestedIndex) => {
    const targetTier = tierDefinitions.find(
      (tier) => String(tier.tierId) === String(targetTierId),
    );

    if (!clothesById[itemId] || !targetTier) return;

    setPlacements((currentPlacements) =>
      movePlacement(
        currentPlacements,
        itemId,
        targetTier.tierId,
        requestedIndex,
      ),
    );
  };

  const handleUnrank = (itemId) => {
    setPlacements((currentPlacements) =>
      movePlacement(currentPlacements, itemId, null),
    );
  };

  const handleDropCandidate = (itemId) => {
    const nextItem = clothesById[itemId];

    if (!nextItem) return;

    setFittingCandidates((currentItems) => [
      ...currentItems.filter(
        (currentItemId) =>
          clothesById[currentItemId]?.category !== nextItem.category,
      ),
      itemId,
    ]);
  };

  const handleRenameTier = (tierId, name) => {
    setTierDefinitions((currentTiers) =>
      currentTiers.map((tier) =>
        String(tier.tierId) === String(tierId) ? { ...tier, name } : tier,
      ),
    );
  };

  const handleReset = () => {
    setTierDefinitions(initialTiers.map((tier) => ({ ...tier })));
    setPlacements(initialPlacements.map((placement) => ({ ...placement })));
    setFittingCandidates([]);
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white shadow-lg shadow-violet-200">
              T
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-extrabold text-slate-900 sm:text-base">
                  티어메이커 디자인
                </h1>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-600">
                  LOCAL
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>스타일 보드</span>
                <TierMakerIcon name="chevron" size={11} />
                <span className="font-medium text-slate-500">DESIGN PREVIEW</span>
                <span>· API 더미 데이터</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
          >
            배치 초기화
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          서버 연결 없이 동작하는 디자인 전용 화면입니다. 의상 배치, 티어명,
          피팅 후보는 새로고침하거나 초기화할 때 원래 상태로 돌아갑니다.
        </p>

        <div className="overflow-x-auto pb-2">
          <div className="relative grid min-h-[720px] w-[1530px] grid-cols-[280px_900px_310px] items-start gap-5">
            <SharedCursorLayer
              cursors={designCursors}
              participants={roomStatus.participants}
              currentParticipantId={1}
              itemLocks={emptyItemLocks}
              clothesById={clothesById}
            />
            <FittingPanel
              candidates={selectedClothes}
              onDropCandidate={handleDropCandidate}
              onRemoveCandidate={(itemId) =>
                setFittingCandidates((currentItems) =>
                  currentItems.filter((currentItemId) => currentItemId !== itemId),
                )
              }
              onDragStart={handleDragStart}
              onDragEnd={noOp}
              onGenerate={noOp}
              canGenerate={false}
              generateDisabledMessage="디자인 미리보기 모드"
              isSubmitting={false}
              tryOn={emptyTryOn}
              errorMessage=""
            />
            <TierBoard
              tiers={tiers}
              clothesById={clothesById}
              onDropTier={handleDropTier}
              onDragStart={handleDragStart}
              onDragEnd={noOp}
              itemLocks={emptyItemLocks}
              currentParticipantId={1}
              canRename
              onRenameTier={handleRenameTier}
            />
            <ClothingCatalog
              clothes={clothes}
              title="의상 보관함"
              description={`총 ${clothes.length}개의 아이템`}
              tierByItem={tierByItem}
              itemLocks={emptyItemLocks}
              currentParticipantId={1}
              onDragStart={handleDragStart}
              onDragEnd={noOp}
              onUnrank={handleUnrank}
            />
          </div>
        </div>

        <ParticipantDock
          participants={roomStatus.participants}
          currentParticipantId={1}
          maxParticipants={4}
          isConnected
          isMicMuted={isMicMuted}
          isSpeakerMuted={isSpeakerMuted}
          isMicControlPending={false}
          voiceConnectionState="CONNECTED"
          voiceError=""
          needsAudioStart={false}
          onToggleMic={() => setIsMicMuted((current) => !current)}
          onToggleSpeaker={() =>
            setIsSpeakerMuted((current) => !current)
          }
          onStartAudio={noOp}
          onRetryVoice={noOp}
        />
      </div>
    </main>
  );
}

export default TierMakerDesignPage;
