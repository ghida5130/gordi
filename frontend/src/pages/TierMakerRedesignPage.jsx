import { useMemo, useState } from "react";
import { motion } from "motion/react";

import logoImage from "@/assets/images/header/logo-image.webp";
import logoText from "@/assets/images/header/logo-text.webp";
import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";

const previewClothes = [
  {
    id: "olive-jacket",
    name: "올리브 오버핏 블레이저",
    category: "OUTER",
    artwork: "jacket",
    color: "text-[#697467]",
    surface: "bg-[#e6e8df]",
  },
  {
    id: "ivory-knit",
    name: "클라우드 케이블 니트",
    category: "TOP",
    artwork: "knit",
    color: "text-[#d8d0bd]",
    surface: "bg-[#f1eee7]",
  },
  {
    id: "sage-shirt",
    name: "세이지 테일러드 셔츠",
    category: "TOP",
    artwork: "shirt",
    color: "text-[#9ca893]",
    surface: "bg-[#e8ece4]",
  },
  {
    id: "wide-pants",
    name: "딥 차콜 와이드 팬츠",
    category: "BOTTOM",
    artwork: "pants",
    color: "text-[#4f5752]",
    surface: "bg-[#dfe2df]",
  },
  {
    id: "cream-cardigan",
    name: "소프트 크림 가디건",
    category: "OUTER",
    artwork: "cardigan",
    color: "text-[#c6ae93]",
    surface: "bg-[#f0e9df]",
  },
  {
    id: "pleats-skirt",
    name: "모스 플리츠 스커트",
    category: "BOTTOM",
    artwork: "skirt",
    color: "text-[#7c866f]",
    surface: "bg-[#e4e8dc]",
  },
  {
    id: "court-sneakers",
    name: "에센셜 코트 스니커즈",
    category: "SHOES",
    artwork: "sneakers",
    color: "text-[#e8e6de]",
    surface: "bg-[#d9ddd8]",
  },
  {
    id: "penny-loafers",
    name: "클래식 페니 로퍼",
    category: "SHOES",
    artwork: "loafers",
    color: "text-[#4a3e35]",
    surface: "bg-[#e5ddd4]",
  },
];

const tierDefinitions = [
  { id: "S", background: "bg-[#f4dca3]", color: "text-[#5c4822]" },
  { id: "A", background: "bg-[#d4e3d2]", color: "text-[#405344]" },
  { id: "B", background: "bg-[#dfe4d5]", color: "text-[#555e4e]" },
  { id: "C", background: "bg-[#e1e3e0]", color: "text-[#505651]" },
];

const initialPlacement = {
  "olive-jacket": "S",
  "ivory-knit": null,
  "sage-shirt": null,
  "wide-pants": "A",
  "cream-cardigan": null,
  "pleats-skirt": "B",
  "court-sneakers": null,
  "penny-loafers": "C",
};

const participants = [
  { id: 1, name: "나", detail: "방장 · 접속 중", color: "from-[#778573] to-[#d9c5ad]" },
  { id: 2, name: "민지", detail: "접속 중", color: "from-[#b58f73] to-[#ead7c4]" },
  { id: 3, name: "철수", detail: "자리 비움", color: "from-[#778278] to-[#d8d8ca]", away: true },
  { id: 4, name: "유리", detail: "접속 중", color: "from-[#606f68] to-[#d7d0c4]" },
];

function PreviewIcon({ name, size = 20, className = "" }) {
  const paths = {
    add: <path d="M12 5v14M5 12h14" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    board: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 8v8M12 8v5M16 8v8" />
      </>
    ),
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="3" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2M4 4l2 2M20 4l-2 2" />
      </>
    ),
    grip: (
      <>
        {[7, 12, 17].flatMap((y) =>
          [9, 15].map((x) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="1.1"
              fill="currentColor"
              stroke="none"
            />
          )),
        )}
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" />
        <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
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

function AvatarIllustration() {
  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-[34px] bg-[#deddd5] sm:min-h-[560px]">
      <div className="absolute inset-x-8 top-6 z-10 flex justify-center">
        <span className="max-w-full truncate rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-[#3e493f] shadow-sm backdrop-blur">
          <span className="mr-2 inline-block size-2 rounded-full bg-[#7e907e]" />
          착장 중 · 올리브 오버핏 블레이저
        </span>
      </div>
      <svg
        aria-label="올리브색 수트를 착용한 아바타"
        viewBox="0 0 360 560"
        className="absolute inset-0 size-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="preview-wall" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#efeee9" />
            <stop offset="1" stopColor="#cbc9bf" />
          </linearGradient>
          <linearGradient id="preview-suit" x1="0" x2="1">
            <stop offset="0" stopColor="#5c695d" />
            <stop offset="1" stopColor="#879083" />
          </linearGradient>
          <linearGradient id="preview-skin" x1="0" x2="1">
            <stop offset="0" stopColor="#c88f6c" />
            <stop offset="1" stopColor="#e4b291" />
          </linearGradient>
          <filter id="preview-shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#51574f" floodOpacity=".2" />
          </filter>
        </defs>
        <rect width="360" height="560" fill="url(#preview-wall)" />
        <path d="M28 390h304v170H28z" fill="#d3d0c6" />
        <path d="M36 110h108v242H36z" fill="#e8e5dc" opacity=".8" />
        <path d="M60 137h61v178H60z" fill="#c9c5b8" opacity=".55" />
        <path d="M245 82h84v310h-84z" fill="#e9e7e0" opacity=".72" />
        <ellipse cx="181" cy="528" rx="91" ry="17" fill="#8e9188" opacity=".25" />
        <g filter="url(#preview-shadow)">
          <path d="M148 169h67l30 38-17 163h-98l-15-163 33-38Z" fill="url(#preview-suit)" />
          <path d="m149 169 31 52 35-52 16 28-28 30-23 106-23-106-26-31 18-27Z" fill="#718074" />
          <path d="M166 180h30l12 46-28 31-27-31 13-46Z" fill="#e5ded3" />
          <path d="M137 198c-20 19-32 73-33 121l22 3 27-103-16-21Z" fill="#657266" />
          <path d="M224 198c24 24 30 78 26 124l-22-1-24-102 20-21Z" fill="#7b867a" />
          <path d="M119 313c4 0 9 2 12 7l-1 30c-4 8-18 8-22 0l-3-30c4-5 9-7 14-7Z" fill="url(#preview-skin)" />
          <path d="M239 312c5 0 10 3 13 8l-2 31c-5 8-18 7-22-1l-1-31c3-4 7-7 12-7Z" fill="url(#preview-skin)" />
          <path d="M143 355h39l-8 161h-49l5-147 13-14Z" fill="#637067" />
          <path d="M182 355h41l9 161h-49l-9-161h8Z" fill="#737e74" />
          <path d="M123 504h52v21c-8 8-42 10-58 1l6-22Z" fill="#ebe8df" />
          <path d="M183 504h50l9 21c-15 10-47 9-58 1l-1-22Z" fill="#eeeae1" />
          <path d="M156 113c1-29 48-31 51 1v30c-2 20-13 29-26 29-14 0-25-11-26-29l1-31Z" fill="url(#preview-skin)" />
          <path d="M153 124c-8-18 1-49 28-53 30-4 45 18 37 50-5-12-12-20-25-24-9 13-22 20-40 27Z" fill="#303630" />
          <path d="M157 105c-8 15-9 37-5 55-13-19-15-46-4-65 14-25 44-31 63-12-22-8-43 1-54 22Z" fill="#3c433d" />
          <path d="M169 137c4 2 8 2 12 0M190 137c4 2 8 2 12 0M179 154c5 3 10 3 15 0" fill="none" stroke="#714b3e" strokeLinecap="round" strokeWidth="1.4" />
          <circle cx="175" cy="132" r="1.4" fill="#3c302c" />
          <circle cx="196" cy="132" r="1.4" fill="#3c302c" />
          <path d="M225 243c28 3 43 19 49 48l-11 101-41-2 3-147Z" fill="#39473d" />
          <path d="M233 267h31" stroke="#7d897d" strokeWidth="2" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/10 to-transparent" />
    </div>
  );
}

function ClothingCard({ item, onDragStart, onDragEnd, compact = false }) {
  return (
    <motion.article
      layout
      draggable
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={onDragEnd}
      whileHover={{ y: -3 }}
      className={`group shrink-0 cursor-grab active:cursor-grabbing ${
        compact ? "w-[82px]" : "w-[112px]"
      }`}
    >
      <div
        className={`relative overflow-hidden bg-[#eef0eb] shadow-sm ring-1 ring-black/5 ${
          compact
            ? "h-[78px] rounded-[24px]"
            : "aspect-square rounded-[30px]"
        }`}
      >
        <ClothingArtwork item={item} className="size-full" />
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-white/80 text-[#5e665d] opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100">
          <PreviewIcon name="grip" size={14} />
        </span>
      </div>
      {!compact && (
        <p className="mt-2 truncate text-center text-xs font-semibold text-[#303630]">
          {item.name}
        </p>
      )}
    </motion.article>
  );
}

function TierRow({ tier, items, isActive, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd }) {
  return (
    <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-4 sm:grid-cols-[76px_minmax(0,1fr)]">
      <div
        className={`flex min-h-[108px] items-center justify-center rounded-[30px] text-lg font-black ${tier.background} ${tier.color}`}
      >
        {tier.id}
      </div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex min-h-[108px] items-center gap-3 overflow-x-auto rounded-[30px] border-2 border-dashed px-4 py-3 transition ${
          isActive
            ? "border-[#738374] bg-[#eef3ed] shadow-inner"
            : "border-[#dfe2dd] bg-[#f8f9f7]"
        }`}
      >
        {items.length > 0 ? (
          items.map((item) => (
            <ClothingCard
              key={item.id}
              item={item}
              compact
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        ) : (
          <div className="flex w-full items-center justify-center gap-2 text-sm font-medium text-[#c4c9c2]">
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-current">
              <PreviewIcon name="add" size={15} />
            </span>
            여기로 드래그
          </div>
        )}
      </div>
    </div>
  );
}

function ParticipantDock() {
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-[1440px] items-center gap-3 rounded-[34px] border border-white/80 bg-[#e7e9e6]/95 p-3 shadow-[0_18px_55px_rgba(48,57,49,0.18)] backdrop-blur-xl sm:px-4">
      <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`flex min-w-[175px] items-center gap-3 rounded-[24px] px-3 py-2 ${
              participant.id === 1 ? "bg-white shadow-sm" : "bg-white/45"
            }`}
          >
            <div
              className={`relative flex size-11 shrink-0 items-end justify-center overflow-hidden rounded-full bg-gradient-to-br ${participant.color}`}
            >
              <span className="text-lg font-black text-white/90">
                {participant.name.slice(0, 1)}
              </span>
              <span
                className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${
                  participant.away ? "bg-amber-400" : "bg-emerald-500"
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[#30372f]">
                {participant.name}
              </p>
              <p className="truncate text-[11px] text-[#7b8179]">
                {participant.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-[#435145] shadow-sm transition hover:bg-[#354537] hover:text-white"
        aria-label="참여자 초대"
      >
        <PreviewIcon name="add" size={22} />
      </button>
    </div>
  );
}

function TierMakerRedesignPage() {
  const [placement, setPlacement] = useState(initialPlacement);
  const [activeDropZone, setActiveDropZone] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState(null);
  const [activeNavigation, setActiveNavigation] = useState("티어메이커");

  const clothesByPlacement = useMemo(
    () =>
      Object.fromEntries([
        ["unassigned", previewClothes.filter((item) => !placement[item.id])],
        ...tierDefinitions.map((tier) => [
          tier.id,
          previewClothes.filter((item) => placement[item.id] === tier.id),
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

  const handleDrop = (event, destination) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggingItemId;

    if (!itemId) return;

    setPlacement((current) => ({
      ...current,
      [itemId]: destination === "unassigned" ? null : destination,
    }));
    handleDragEnd();
  };

  const activateDropZone = (event, destination) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveDropZone(destination);
  };

  return (
    <main className="min-h-screen bg-[#f4f5f1] pb-36 text-[#30372f]">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-[#f8f9f6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[84px] max-w-[1536px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="flex size-12 items-center justify-center rounded-[19px] bg-[#354537] text-white shadow-sm transition hover:-translate-y-0.5"
              aria-label="새 작업 만들기"
            >
              <PreviewIcon name="add" size={24} />
            </button>
            <div className="flex h-12 items-center gap-3 rounded-full bg-[#e5e8e4] px-4">
              <img src={logoImage} alt="" className="size-7 object-contain" />
              <img src={logoText} alt="GORDI" className="h-4 w-auto object-contain" />
            </div>
          </div>

          <nav className="hidden items-center rounded-full bg-[#f1f2ef] p-1 md:flex">
            {["티어메이커", "AI 의상 추천", "체형 설정", "마이페이지"].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveNavigation(item)}
                  className={`rounded-full px-7 py-3 text-sm font-bold transition lg:px-10 ${
                    activeNavigation === item
                      ? "bg-[#354537] text-white shadow-sm"
                      : "text-[#686f66] hover:text-[#354537]"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-full bg-white text-[#343b34] shadow-sm"
              aria-label="알림"
            >
              <PreviewIcon name="bell" size={20} />
            </button>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-full bg-white text-[#343b34] shadow-sm"
              aria-label="메뉴"
            >
              <PreviewIcon name="menu" size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1536px] gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[370px_minmax(0,1fr)] xl:px-8">
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="h-fit rounded-[42px] bg-white p-5 shadow-[0_18px_60px_rgba(48,57,49,0.07)] lg:sticky lg:top-[108px]"
        >
          <div className="flex items-center gap-3 px-1 py-2">
            <PreviewIcon name="user" size={24} className="text-[#435145]" />
            <div>
              <h1 className="text-xl font-black">아바타</h1>
              <p className="mt-0.5 text-xs text-[#8a9088]">
                선택한 의상을 바로 피팅해보세요
              </p>
            </div>
          </div>

          <div className="mt-5">
            <AvatarIllustration />
          </div>

          <button
            type="button"
            className="mt-5 flex w-full items-center justify-between rounded-full border border-[#e0e3de] bg-[#f7f8f6] px-5 py-3 text-left text-xs font-medium text-[#727972] transition hover:border-[#9ba69a]"
          >
            <span className="truncate">오버핏, 롤업 등 착장 옵션 입력</span>
            <PreviewIcon name="sliders" size={18} />
          </button>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#354537] px-5 py-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#26372a]"
          >
            <PreviewIcon name="sparkles" size={18} />
            아바타 생성하기
          </button>
          <p className="mt-4 text-center text-[11px] leading-5 text-[#90958e]">
            세부 스타일 옵션을 선택해 아바타를 커스터마이즈하세요.
          </p>
        </motion.aside>

        <div className="min-w-0 space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[42px] bg-white p-5 shadow-[0_18px_60px_rgba(48,57,49,0.07)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-[#edf0eb] text-[#435145]">
                  <PreviewIcon name="board" size={21} />
                </span>
                <div>
                  <h2 className="text-xl font-black">공동 티어메이커</h2>
                  <p className="mt-1 text-xs text-[#8a9088]">
                    참여자들과 의상을 드래그해 순위를 정해보세요
                  </p>
                </div>
              </div>
              <div className="flex gap-2 text-[#657064]">
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full hover:bg-[#f0f2ee]"
                  aria-label="필터"
                >
                  <PreviewIcon name="filter" size={19} />
                </button>
                <button
                  type="button"
                  onClick={() => setPlacement(initialPlacement)}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-[#f0f2ee]"
                  aria-label="배치 초기화"
                >
                  <PreviewIcon name="more" size={19} />
                </button>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-black tracking-[0.12em] text-[#555d54]">
                  미분류 아이템
                </p>
                <span className="rounded-full bg-[#f0f2ee] px-3 py-1 text-[11px] font-bold text-[#737a72]">
                  {clothesByPlacement.unassigned.length}개
                </span>
              </div>
              <div
                onDragOver={(event) => activateDropZone(event, "unassigned")}
                onDragLeave={() => setActiveDropZone(null)}
                onDrop={(event) => handleDrop(event, "unassigned")}
                className={`flex min-h-[148px] gap-4 overflow-x-auto rounded-[30px] border-2 px-4 py-4 transition ${
                  activeDropZone === "unassigned"
                    ? "border-dashed border-[#738374] bg-[#eef3ed]"
                    : "border-transparent bg-[#fafbf9]"
                }`}
              >
                {clothesByPlacement.unassigned.map((item) => (
                  <ClothingCard
                    key={item.id}
                    item={item}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
                {clothesByPlacement.unassigned.length === 0 && (
                  <p className="m-auto text-sm font-medium text-[#b9beb8]">
                    티어의 아이템을 이곳으로 드래그하세요
                  </p>
                )}
              </div>
            </div>

            <div className="mt-7 space-y-4">
              {tierDefinitions.map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  items={clothesByPlacement[tier.id]}
                  isActive={activeDropZone === tier.id}
                  onDragOver={(event) => activateDropZone(event, tier.id)}
                  onDragLeave={() => setActiveDropZone(null)}
                  onDrop={(event) => handleDrop(event, tier.id)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-[38px] bg-white p-6 shadow-[0_18px_60px_rgba(48,57,49,0.06)] sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.12em] text-[#7a8179]">
                  FITTING CANDIDATES
                </p>
                <h2 className="mt-2 text-lg font-black">피팅 후보 보관함</h2>
              </div>
              <span className="rounded-full bg-[#edf1eb] px-4 py-2 text-xs font-bold text-[#4f5d50]">
                S 티어 중심 추천
              </span>
            </div>
            <div className="mt-5 flex min-h-[112px] items-center gap-3 overflow-x-auto rounded-[28px] border-2 border-dashed border-[#dfe2dd] bg-[#f8f9f7] p-4">
              {[...clothesByPlacement.S, ...clothesByPlacement.A].map((item) => (
                <ClothingCard
                  key={`fitting-${item.id}`}
                  item={item}
                  compact
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
              {clothesByPlacement.S.length + clothesByPlacement.A.length ===
                0 && (
                <p className="m-auto text-sm text-[#b9beb8]">
                  S 또는 A 티어에 의상을 추가해보세요
                </p>
              )}
            </div>
          </motion.section>
        </div>
      </div>

      <ParticipantDock />
    </main>
  );
}

export default TierMakerRedesignPage;
