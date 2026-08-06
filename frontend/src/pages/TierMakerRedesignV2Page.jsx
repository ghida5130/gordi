import { useMemo, useState } from "react";
import { motion } from "motion/react";

import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";

const previewItems = [
  {
    id: "wool-blazer",
    name: "울 블레이저",
    artwork: "jacket",
    color: "text-[#353638]",
    surface: "bg-[#ededed]",
  },
  {
    id: "leather-bag",
    name: "레더 호보백",
    artwork: "bag",
    color: "text-[#413934]",
    surface: "bg-[#efefed]",
  },
  {
    id: "cashmere-knit",
    name: "캐시미어 니트",
    artwork: "knit",
    color: "text-[#d2c8b5]",
    surface: "bg-[#eceae5]",
  },
  {
    id: "silk-trench",
    name: "실크 트렌치",
    artwork: "jacket",
    color: "text-[#85817b]",
    surface: "bg-[#e7e7e5]",
  },
];

const tiers = [
  { id: "S", background: "bg-black", text: "text-white" },
  { id: "A", background: "bg-[#1d1d1d]", text: "text-white" },
  { id: "B", background: "bg-[#666666]", text: "text-white" },
  { id: "C", background: "bg-[#dedee0]", text: "text-[#252525]" },
];

const initialPlacement = {
  "wool-blazer": null,
  "leather-bag": null,
  "cashmere-knit": null,
  "silk-trench": "S",
};

const participants = [
  { id: 1, name: "나", state: "HOST", online: true, initial: "N" },
  { id: 2, name: "민지", online: true, initial: "M" },
  { id: 3, name: "철수", online: true, initial: "C" },
  { id: 4, name: "유리", online: false, initial: "Y" },
];

function PreviewIcon({ name, size = 20, className = "" }) {
  const paths = {
    more: (
      <>
        <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </>
    ),
    pencil: (
      <>
        <path d="m4 20 4.5-1L19 8.5 15.5 5 5 15.5 4 20Z" />
        <path d="m13.5 7 3.5 3.5" />
      </>
    ),
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    tray: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M4 14h4l2 2h4l2-2h4" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

function MannequinPreview() {
  return (
    <div className="relative min-h-[590px] overflow-hidden rounded-2xl bg-[#e6e6e4]">
      <svg
        viewBox="0 0 320 620"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        aria-label="회색 트렌치코트를 착용한 마네킹"
      >
        <defs>
          <linearGradient id="v2-wall" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#eeeeec" />
            <stop offset="1" stopColor="#cfcfcd" />
          </linearGradient>
          <linearGradient id="v2-body" x1="0" x2="1">
            <stop offset="0" stopColor="#dbdbd8" />
            <stop offset=".55" stopColor="#f3f3f1" />
            <stop offset="1" stopColor="#c8c8c5" />
          </linearGradient>
          <linearGradient id="v2-coat" x1="0" x2="1">
            <stop offset="0" stopColor="#67686a" />
            <stop offset=".5" stopColor="#9a9a9b" />
            <stop offset="1" stopColor="#5d5e60" />
          </linearGradient>
          <filter id="v2-shadow" x="-30%" y="-20%" width="160%" height="170%">
            <feDropShadow dx="0" dy="15" stdDeviation="11" floodColor="#707070" floodOpacity=".24" />
          </filter>
        </defs>
        <rect width="320" height="620" fill="url(#v2-wall)" />
        <path d="M0 486h320v134H0z" fill="#d6d6d4" />
        <path d="M0 482h320" stroke="#c8c8c6" strokeWidth="2" />
        <ellipse cx="160" cy="584" rx="81" ry="15" fill="#999" opacity=".24" />
        <g filter="url(#v2-shadow)">
          <ellipse cx="160" cy="91" rx="34" ry="46" fill="url(#v2-body)" />
          <path d="M151 132h18v35h-18z" fill="url(#v2-body)" />
          <path d="M111 161h98l24 80-18 212H105L87 241l24-80Z" fill="url(#v2-coat)" />
          <path d="m113 162 47 72 47-72 15 48-37 42-25 122-26-122-37-42 16-48Z" fill="#747577" />
          <path d="m113 162 47 32 47-32-16-16-31 17-31-17-16 16Z" fill="#b2b2b1" />
          <path d="M100 187c-23 20-32 90-32 179h31l33-158-32-21Z" fill="#707174" />
          <path d="M220 187c23 20 32 90 32 179h-31l-33-158 32-21Z" fill="#66676a" />
          <path d="M70 350c-8 4-10 18-5 30 5 9 23 9 29 0 5-12 2-26-7-30H70Z" fill="url(#v2-body)" />
          <path d="M233 350c-9 4-12 18-7 30 6 9 24 9 29 0 5-12 3-26-5-30h-17Z" fill="url(#v2-body)" />
          <path d="M116 435h42l-9 142H98l7-124 11-18Z" fill="url(#v2-body)" />
          <path d="M162 435h42l11 18 7 124h-51l-9-142Z" fill="url(#v2-body)" />
          <path d="M97 568h53v20c-10 7-39 8-57 1l4-21Z" fill="#d7d7d4" />
          <path d="M171 568h52l5 21c-18 8-47 7-57-1v-20Z" fill="#d7d7d4" />
          <path d="M103 261h114M108 329h104M121 189h78" stroke="#505154" strokeOpacity=".52" strokeWidth="3" />
          <path d="M120 261 103 452M200 261l17 192" stroke="#4d4e51" strokeOpacity=".42" strokeWidth="2" />
          <circle cx="171" cy="278" r="3" fill="#4a4b4d" />
          <circle cx="171" cy="309" r="3" fill="#4a4b4d" />
          <circle cx="171" cy="340" r="3" fill="#4a4b4d" />
          <path d="M107 232h35v25h-39M178 232h35l4 25h-39" fill="none" stroke="#555659" strokeWidth="2" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
        <span className="max-w-full truncate rounded-full bg-white/92 px-4 py-2 text-xs font-bold text-[#3b3b3b] shadow-sm backdrop-blur">
          <span className="mr-2 inline-block size-2 rounded-full bg-[#676767]" />
          착장 중 · 실크 트렌치 코트
        </span>
      </div>
    </div>
  );
}

function BagArtwork({ item }) {
  return (
    <div className={`flex size-full items-center justify-center ${item.surface}`}>
      <svg viewBox="0 0 120 100" className={`size-full ${item.color}`} aria-hidden="true">
        <path d="M25 42c3-22 19-32 35-32s32 10 35 32h-9C82 26 73 20 60 20s-22 6-26 22h-9Z" fill="currentColor" opacity=".72" />
        <path d="M18 40c13 7 71 7 84 0l-6 46c-19 9-53 9-72 0l-6-46Z" fill="currentColor" />
        <path d="M24 48c19 8 53 8 72 0" fill="none" stroke="white" strokeOpacity=".28" strokeWidth="2" />
      </svg>
    </div>
  );
}

function ProductArtwork({ item }) {
  if (item.artwork === "bag") return <BagArtwork item={item} />;

  return <ClothingArtwork item={item} className="size-full" />;
}

function ProductCard({ item, compact = false, onDragStart, onDragEnd }) {
  return (
    <motion.article
      layout
      draggable
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={onDragEnd}
      whileHover={{ y: -2 }}
      className={`shrink-0 cursor-grab rounded-xl border border-[#e7e7e9] bg-[#fafafa] p-2 shadow-sm active:cursor-grabbing ${
        compact ? "w-[104px]" : "w-[150px]"
      }`}
    >
      <div
        className={`overflow-hidden rounded-lg bg-[#eeeeec] ${
          compact ? "h-[74px]" : "h-[132px]"
        }`}
      >
        <ProductArtwork item={item} />
      </div>
      <p className="mt-2 truncate text-center text-xs font-black text-[#242424]">
        {item.name}
      </p>
    </motion.article>
  );
}

function TierRow({ tier, items, active, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-4">
      <div
        className={`flex min-h-[150px] items-center justify-center rounded-xl text-2xl font-black ${tier.background} ${tier.text}`}
      >
        {tier.id}
      </div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex min-h-[150px] items-center gap-3 overflow-x-auto rounded-xl border border-dashed p-4 transition ${
          active
            ? "border-black bg-[#f2f2f3] ring-2 ring-black/5"
            : "border-[#e3e3e5] bg-white"
        }`}
      >
        {items.length > 0 ? (
          items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              compact
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        ) : (
          <p className="m-auto text-sm font-bold text-[#d0d0d2]">
            여기로 드래그
          </p>
        )}
      </div>
    </div>
  );
}

function ParticipantBar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex h-[88px] items-center border-t border-[#e5e5e7] bg-white/95 px-4 shadow-[0_-8px_30px_rgba(0,0,0,0.03)] backdrop-blur-lg sm:px-6">
      <div className="mr-6 flex h-12 shrink-0 items-center gap-2 border-r border-[#e7e7e7] pr-7 text-sm font-black">
        <PreviewIcon name="users" size={21} />
        <span className="hidden sm:inline">접속 인원 (4)</span>
        <span className="sm:hidden">4</span>
      </div>
      <div className="flex min-w-0 gap-3 overflow-x-auto">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex min-w-[122px] items-center gap-2 rounded-full border border-[#e5e5e7] bg-white px-3 py-2"
          >
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[#ededed] text-xs font-black text-[#737373]">
              {participant.initial}
              <i
                className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${
                  participant.online ? "bg-[#57c58a]" : "bg-[#bcbcbc]"
                }`}
              />
            </span>
            <span className="truncate text-xs font-bold">{participant.name}</span>
            {participant.state && (
              <span className="rounded bg-black px-1.5 py-0.5 text-[8px] font-black text-white">
                {participant.state}
              </span>
            )}
          </div>
        ))}
      </div>
    </footer>
  );
}

function TierMakerRedesignV2Page() {
  const [placement, setPlacement] = useState(initialPlacement);
  const [activeDropZone, setActiveDropZone] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState(null);

  const itemsByPlacement = useMemo(
    () =>
      Object.fromEntries([
        ["waiting", previewItems.filter((item) => !placement[item.id])],
        ...tiers.map((tier) => [
          tier.id,
          previewItems.filter((item) => placement[item.id] === tier.id),
        ]),
      ]),
    [placement],
  );

  const handleDragStart = (event, itemId) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    setDraggingItemId(itemId);
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
    setActiveDropZone(null);
  };

  const handleDragOver = (event, destination) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveDropZone(destination);
  };

  const handleDrop = (event, destination) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggingItemId;

    if (!itemId) return;

    setPlacement((current) => ({
      ...current,
      [itemId]: destination === "waiting" ? null : destination,
    }));
    handleDragEnd();
  };

  return (
    <main className="min-h-screen bg-[#f7f7f9] pb-[88px] text-black">
      <div className="grid min-h-[calc(100vh-88px)] lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-r border-[#e6e6e8] bg-[#f2f2f4] p-4 sm:p-5">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="mx-auto rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-5"
          >
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black">아바타</h1>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full text-[#777] hover:bg-[#f2f2f2]"
                aria-label="아바타 메뉴"
              >
                <PreviewIcon name="more" size={20} />
              </button>
            </div>

            <div className="mt-5">
              <MannequinPreview />
            </div>

            <button
              type="button"
              className="mt-3 flex w-full items-center gap-3 rounded-full bg-[#f0f0f2] px-5 py-4 text-left text-sm font-bold text-[#858589] transition hover:bg-[#e8e8ea]"
            >
              <PreviewIcon name="pencil" size={19} className="text-[#3f3f42]" />
              프롬프트 입력
            </button>
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-black px-5 py-4 text-sm font-black text-white transition hover:bg-[#222]"
            >
              아바타 생성하기
              <PreviewIcon name="arrow" size={20} />
            </button>
          </motion.div>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-7 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                  공동 티어메이커
                </h2>
                <span className="flex items-center gap-2 rounded-full bg-[#e9e9eb] px-4 py-2 text-xs font-bold text-[#535356]">
                  <i className="size-2 rounded-full bg-black" />
                  실시간 동기화 중
                </span>
              </div>
              <button
                type="button"
                className="rounded-full bg-black px-6 py-3 text-xs font-black text-white transition hover:bg-[#252525]"
              >
                보드 종료&nbsp;&nbsp; → &nbsp;&nbsp;S-09
              </button>
            </header>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 rounded-2xl border border-[#e4e4e6] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 text-sm font-black text-[#55555a]">
                <PreviewIcon name="tray" size={21} />
                대기열 (Uncategorized)
              </div>
              <div
                onDragOver={(event) => handleDragOver(event, "waiting")}
                onDragLeave={() => setActiveDropZone(null)}
                onDrop={(event) => handleDrop(event, "waiting")}
                className={`mt-5 flex min-h-[174px] gap-4 overflow-x-auto rounded-xl border p-3 transition ${
                  activeDropZone === "waiting"
                    ? "border-dashed border-black bg-[#f3f3f4]"
                    : "border-transparent"
                }`}
              >
                {itemsByPlacement.waiting.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
                {Array.from({
                  length: Math.max(0, 5 - itemsByPlacement.waiting.length),
                }).map((_, index) => (
                  <div
                    key={`empty-slot-${index}`}
                    className="h-[170px] w-[150px] shrink-0 rounded-xl border border-dashed border-[#eeeeef] bg-[#fdfdfd]"
                  />
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-8 space-y-4"
            >
              {tiers.map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  items={itemsByPlacement[tier.id]}
                  active={activeDropZone === tier.id}
                  onDragOver={(event) => handleDragOver(event, tier.id)}
                  onDragLeave={() => setActiveDropZone(null)}
                  onDrop={(event) => handleDrop(event, tier.id)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </motion.div>
          </div>
        </section>
      </div>

      <ParticipantBar />
    </main>
  );
}

export default TierMakerRedesignV2Page;
