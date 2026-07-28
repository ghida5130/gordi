import { useMemo, useState } from "react";

import ClothingCatalog from "@/components/tierMaker/ClothingCatalog";
import FittingPanel from "@/components/tierMaker/FittingPanel";
import ParticipantDock from "@/components/tierMaker/ParticipantDock";
import TierBoard from "@/components/tierMaker/TierBoard";
import TierMakerIcon from "@/components/tierMaker/TierMakerIcon";

const clothes = [
  {
    id: "black-blazer",
    name: "클래식 블랙 블레이저",
    category: "outer",
    categoryLabel: "아우터",
    artwork: "jacket",
    color: "text-slate-800",
    surface: "bg-slate-100",
    fittingColor: "#1e293b",
  },
  {
    id: "cream-cardigan",
    name: "크림 니트 가디건",
    category: "outer",
    categoryLabel: "아우터",
    artwork: "cardigan",
    color: "text-[#d8c2ad]",
    surface: "bg-[#f7f2ec]",
    fittingColor: "#d8c2ad",
  },
  {
    id: "blue-shirt",
    name: "옥스퍼드 블루 셔츠",
    category: "top",
    categoryLabel: "상의",
    artwork: "shirt",
    color: "text-sky-300",
    surface: "bg-sky-50",
    fittingColor: "#7dd3fc",
  },
  {
    id: "stripe-knit",
    name: "스트라이프 니트",
    category: "top",
    categoryLabel: "상의",
    artwork: "knit",
    color: "text-indigo-500",
    surface: "bg-indigo-50",
    fittingColor: "#6366f1",
  },
  {
    id: "wide-denim",
    name: "워시드 와이드 데님",
    category: "bottom",
    categoryLabel: "하의",
    artwork: "pants",
    color: "text-blue-500",
    surface: "bg-blue-50",
    fittingColor: "#3b82f6",
  },
  {
    id: "pleats-skirt",
    name: "차콜 플리츠 스커트",
    category: "bottom",
    categoryLabel: "하의",
    artwork: "skirt",
    color: "text-slate-600",
    surface: "bg-slate-100",
    fittingColor: "#475569",
  },
  {
    id: "brown-loafers",
    name: "브라운 페니 로퍼",
    category: "shoes",
    categoryLabel: "신발",
    artwork: "loafers",
    color: "text-amber-800",
    surface: "bg-amber-50",
    fittingColor: "#92400e",
  },
  {
    id: "white-sneakers",
    name: "오프화이트 스니커즈",
    category: "shoes",
    categoryLabel: "신발",
    artwork: "sneakers",
    color: "text-slate-100",
    surface: "bg-slate-200",
    fittingColor: "#f8fafc",
  },
];

const initialTiers = {
  S: ["black-blazer"],
  A: ["blue-shirt", "wide-denim"],
  B: ["cream-cardigan"],
  C: [],
  "-": [],
};

function TierMakerRoomPage() {
  const [tiers, setTiers] = useState(initialTiers);
  const [fittingCandidates, setFittingCandidates] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const clothesById = useMemo(
    () => Object.fromEntries(clothes.map((item) => [item.id, item])),
    [],
  );

  const tierByItem = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(tiers).flatMap(([tier, itemIds]) =>
          itemIds.map((itemId) => [itemId, tier]),
        ),
      ),
    [tiers],
  );

  const candidates = fittingCandidates.map((itemId) => clothesById[itemId]);

  const handleDragStart = (event, itemId) => {
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", itemId);
  };

  const handleDropTier = (itemId, targetTier) => {
    if (!clothesById[itemId] || !targetTier) return;

    setTiers((currentTiers) =>
      Object.fromEntries(
        Object.entries(currentTiers).map(([tier, itemIds]) => [
          tier,
          tier === targetTier
            ? [...itemIds.filter((id) => id !== itemId), itemId]
            : itemIds.filter((id) => id !== itemId),
        ]),
      ),
    );
  };

  const handleUnrank = (itemId) => {
    setTiers((currentTiers) =>
      Object.fromEntries(
        Object.entries(currentTiers).map(([tier, itemIds]) => [
          tier,
          itemIds.filter((id) => id !== itemId),
        ]),
      ),
    );
  };

  const handleDropCandidate = (itemId) => {
    const nextItem = clothesById[itemId];
    if (!nextItem) return;

    setFittingCandidates((currentItems) => [
      ...currentItems.filter(
        (currentItemId) =>
          clothesById[currentItemId].category !== nextItem.category,
      ),
      itemId,
    ]);
  };

  const tempMessage = import.meta.env.VITE_TEMP_MESSAGE;

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
                  가을 데일리룩 월드컵
                </h1>
                <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 sm:inline-flex">
                  참여 중
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>스타일 보드</span>
                <TierMakerIcon name="chevron" size={11} />
                <span className="font-medium text-slate-500">ROOM 28A4</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:flex"
            >
              <TierMakerIcon name="add" size={16} />
              의상 추가
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
            >
              <TierMakerIcon name="door" size={16} />
              보드 종료
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(520px,1fr)_310px]">
          <FittingPanel
            candidates={candidates}
            onDropCandidate={handleDropCandidate}
            onRemoveCandidate={(itemId) =>
              setFittingCandidates((currentItems) =>
                currentItems.filter((id) => id !== itemId),
              )
            }
            onDragStart={handleDragStart}
          />
          <TierBoard
            tiers={tiers}
            clothesById={clothesById}
            onDropTier={handleDropTier}
            onDragStart={handleDragStart}
          />
          <ClothingCatalog
            clothes={clothes}
            tierByItem={tierByItem}
            onDragStart={handleDragStart}
            onUnrank={handleUnrank}
          />
        </div>

        <ParticipantDock
          isMicMuted={isMicMuted}
          isSpeakerMuted={isSpeakerMuted}
          onToggleMic={() => setIsMicMuted((current) => !current)}
          onToggleSpeaker={() => setIsSpeakerMuted((current) => !current)}
        />
      </div>
      <section className="mt-10 rounded-2xl border border-brand-500/20 bg-brand-50 p-5">
        <p className="text-sm font-semibold text-brand-600">
          임시 환경변수 확인
        </p>
        <p className="mt-2 break-words font-mono text-sm text-slate-700">
          {tempMessage}
        </p>
      </section>
    </main>
  );
}

export default TierMakerRoomPage;
