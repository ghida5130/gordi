import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import logoImage from "@/assets/images/header/logo-image.webp";
import logoText from "@/assets/images/header/logo-text.webp";
import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";
import {
  designCandidatesResponse,
  designProductResponses,
  designRoomStatusResponse,
} from "@/data/tierMakerDesignData";
import { createTierMakerClothing } from "@/utils/tierMakerClothing";

const roomStatus = designRoomStatusResponse.data;
const clothes = designCandidatesResponse.data.items.map((roomItem) =>
  createTierMakerClothing(
    roomItem,
    designProductResponses[roomItem.productId]?.data,
  ),
);
const initialPlacement = Object.fromEntries(
  designCandidatesResponse.data.items.map((item) => [
    String(item.roomItemId),
    item.tierId == null ? null : String(item.tierId),
  ]),
);
const tierColors = [
  { background: "bg-[#ffcaed]", text: "text-[#5b1847]", accent: "#f05bbb" },
  { background: "bg-[#cdbfff]", text: "text-[#342575]", accent: "#826bff" },
  { background: "bg-[#bfe9ff]", text: "text-[#174964]", accent: "#4db9f5" },
  { background: "bg-[#dcf6c5]", text: "text-[#31531e]", accent: "#8fca5b" },
];
const participantColors = ["#7657ff", "#ff6bb3", "#32b8e8", "#89bd4f"];

function Icon({ name, size = 18 }) {
  const paths = {
    add: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    cursor: <path d="m5 3 14 9-6 2-3 6-5-17Z" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    hand: <path d="M7 11V7a2 2 0 0 1 4 0v3-5a2 2 0 0 1 4 0v5-2a2 2 0 0 1 4 0v6c0 5-3 7-7 7h-1c-3 0-5-2-7-5l-1-2a2 2 0 0 1 4-3Z" />,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>,
    magic: <><path d="m12 3-1.1 3.1L8 7.2l2.9 1.1L12 11l1.1-2.7L16 7.2l-2.9-1.1L12 3Z" /><path d="m6 13-.8 2.2L3 16l2.2.8L6 19l.8-2.2L9 16l-2.2-.8L6 13Z" /></>,
    pause: <><path d="M9 5v14M15 5v14" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
    text: <><path d="M5 5h14M12 5v14M8 19h8" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function ToolButton({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex size-9 items-center justify-center rounded-xl transition ${active ? "bg-[#7657ff] text-white shadow-[0_8px_22px_rgba(118,87,255,0.35)]" : "text-[#6c6978] hover:bg-[#f0eef8] hover:text-[#201d29]"}`}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

function ClothingCard({ item, compact = false, selected, onSelect, onDragStart }) {
  return (
    <motion.button
      layout
      type="button"
      draggable
      onClick={() => onSelect(item)}
      onDragStart={(event) => onDragStart(event, item.id)}
      whileHover={{ y: -4, rotate: selected ? 0 : -1 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative min-w-0 text-left ${compact ? "w-full" : "w-[104px]"}`}
    >
      <div className={`relative overflow-hidden border bg-white shadow-sm transition ${compact ? "aspect-square rounded-[18px]" : "aspect-square rounded-[24px]"} ${selected ? "border-[#7657ff] ring-2 ring-[#7657ff]/20" : "border-black/5 group-hover:border-[#7657ff]/30"}`}>
        <ClothingArtwork item={item} className="size-full" />
        <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-white/90 text-[9px] font-black text-[#3d374c] opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100">
          +
        </span>
      </div>
      <p className={`${compact ? "mt-1.5 text-[10px]" : "mt-2 text-[11px]"} truncate text-center font-bold text-[#3f3b49]`}>
        {item.name}
      </p>
    </motion.button>
  );
}

function AvatarStage({ fittingItems, isGenerating }) {
  const jacket = fittingItems[0];

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-[#e8e4ff] p-3">
      <div className="absolute -right-10 -top-12 size-36 rounded-full bg-[#ffbce5] blur-2xl" />
      <div className="absolute -bottom-12 -left-8 size-36 rounded-full bg-[#a9eaff] blur-2xl" />
      <div className="relative flex h-[250px] items-end justify-center overflow-hidden rounded-[20px] bg-white/55 backdrop-blur-sm">
        <motion.div
          animate={isGenerating ? { opacity: [1, 0.55, 1], scale: [1, 0.98, 1] } : { opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, repeat: isGenerating ? Infinity : 0 }}
          className="relative h-[224px] w-[138px]"
        >
          <div className="absolute left-1/2 top-1 size-12 -translate-x-1/2 rounded-full bg-[#d7b29f] shadow-inner" />
          <div className="absolute left-1/2 top-[46px] h-4 w-5 -translate-x-1/2 rounded bg-[#d7b29f]" />
          <div className={`absolute left-1/2 top-[58px] h-[92px] w-[82px] -translate-x-1/2 rounded-[28px_28px_18px_18px] shadow-md ${jacket?.surface ?? "bg-white"}`}>
            {jacket && <ClothingArtwork item={jacket} className="size-full rounded-[28px_28px_18px_18px]" />}
          </div>
          <div className="absolute left-[20px] top-[66px] h-[96px] w-[18px] rotate-[8deg] rounded-full bg-[#d7b29f]" />
          <div className="absolute right-[20px] top-[66px] h-[96px] w-[18px] -rotate-[8deg] rounded-full bg-[#d7b29f]" />
          <div className="absolute bottom-1 left-[36px] h-[86px] w-[27px] rounded-b-xl bg-[#37333f]" />
          <div className="absolute bottom-1 right-[36px] h-[86px] w-[27px] rounded-b-xl bg-[#37333f]" />
        </motion.div>
        {isGenerating && (
          <div className="absolute inset-x-5 bottom-4 rounded-full bg-[#201d29]/90 px-4 py-2 text-center text-[10px] font-bold text-white">
            AI가 착장을 렌더링 중이에요
          </div>
        )}
      </div>
    </div>
  );
}

function Timeline({ participants, isPlaying, onTogglePlay }) {
  return (
    <section className="grid grid-cols-[252px_minmax(0,1fr)_278px] border-t border-[#dedbe8] bg-white">
      <div className="flex items-center gap-3 border-r border-[#e6e3ed] px-4 py-3">
        <button type="button" onClick={onTogglePlay} className="flex size-10 items-center justify-center rounded-full bg-[#201d29] text-white transition hover:scale-105">
          <Icon name={isPlaying ? "pause" : "play"} size={16} />
        </button>
        <div>
          <p className="text-xs font-black text-[#292530]">보드 활동</p>
          <p className="mt-0.5 text-[10px] text-[#918c9e]">실시간 편집 타임라인</p>
        </div>
      </div>
      <div className="relative flex items-center px-6">
        <div className="absolute inset-x-6 h-px bg-[#d9d5e4]" />
        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <span key={tick} className="absolute top-3 text-[9px] font-semibold text-[#a09ba9]" style={{ left: `${4 + tick * 18}%` }}>
            {tick * 2}s
          </span>
        ))}
        <motion.div
          animate={{ left: isPlaying ? ["5%", "91%"] : "38%" }}
          transition={{ duration: 8, ease: "linear", repeat: isPlaying ? Infinity : 0 }}
          className="absolute top-2 h-12 w-px bg-[#7657ff]"
        >
          <span className="absolute -left-1.5 -top-1 size-3 rounded-full border-2 border-white bg-[#7657ff] shadow" />
        </motion.div>
        <div className="ml-[14%] h-5 w-[20%] rounded-md bg-[#cdbfff]" />
        <div className="ml-2 h-5 w-[26%] rounded-md bg-[#ffcaed]" />
        <div className="ml-2 h-5 w-[18%] rounded-md bg-[#bfe9ff]" />
      </div>
      <div className="flex items-center justify-end gap-2 border-l border-[#e6e3ed] px-4">
        <span className="mr-1 text-[10px] font-bold text-[#817c8d]">LIVE</span>
        {participants.map((participant, index) => (
          <div key={participant.participantId} title={participant.nickname} className="relative flex size-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-black text-white shadow-sm" style={{ background: participantColors[index % participantColors.length], marginLeft: index === 0 ? 0 : -8 }}>
            {participant.nickname.slice(0, 1)}
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-[#46cf8b]" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TierMakerJitterPage() {
  const [placements, setPlacements] = useState(initialPlacement);
  const [selectedItem, setSelectedItem] = useState(clothes[0]);
  const [fittingIds, setFittingIds] = useState([clothes[0].id]);
  const [activeTier, setActiveTier] = useState(null);
  const [search, setSearch] = useState("");
  const [panelMode, setPanelMode] = useState("design");
  const [activeTool, setActiveTool] = useState("cursor");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const filteredClothes = clothes.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const waitingItems = clothes.filter((item) => placements[item.id] == null);
  const fittingItems = fittingIds.map((id) => clothes.find((item) => item.id === id)).filter(Boolean);
  const tiers = useMemo(
    () => roomStatus.tiers
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((tier) => ({
        ...tier,
        id: String(tier.tierId),
        items: clothes.filter((item) => placements[item.id] === String(tier.tierId)),
      })),
    [placements],
  );

  const handleDragStart = (event, itemId) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  };
  const moveItem = (itemId, tierId) => {
    if (!clothes.some((item) => item.id === itemId)) return;
    setPlacements((current) => ({ ...current, [itemId]: tierId }));
    setActiveTier(null);
  };
  const toggleFitting = (itemId) => {
    setFittingIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current.slice(-1), itemId]);
  };
  const handleGenerate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    window.setTimeout(() => setIsGenerating(false), 1800);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f1f8] text-[#201d29]">
      <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(#c9c4d5 0.75px, transparent 0.75px)", backgroundSize: "18px 18px" }} />
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-20 flex h-[78px] min-w-[1260px] items-center justify-between border-b border-black/5 bg-white/85 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 border-r border-[#e6e3ed] pr-5">
            <img src={logoImage} alt="" className="h-5 w-auto" />
            <img src={logoText} alt="gordi" className="h-4 w-auto" />
          </div>
          <button type="button" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black hover:bg-[#f1eff6]">
            공동 티어메이커 <span className="text-[#a09ba9]">/</span> Summer edit
            <Icon name="chevron" size={14} />
          </button>
          <span className="rounded-full bg-[#e9fff3] px-3 py-1 text-[10px] font-black text-[#208653]">● 실시간 동기화</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPlacements(initialPlacement)} className="rounded-full px-4 py-2.5 text-xs font-black text-[#666171] transition hover:bg-[#f1eff6]">초기화</button>
          <button type="button" className="flex items-center gap-2 rounded-full border border-[#ded9e8] bg-white px-4 py-2.5 text-xs font-black shadow-sm transition hover:-translate-y-0.5"><Icon name="users" size={15} /> 공유</button>
          <button type="button" className="flex items-center gap-2 rounded-full bg-[#201d29] px-5 py-2.5 text-xs font-black text-white shadow-[0_10px_28px_rgba(32,29,41,0.22)] transition hover:scale-[1.02]">보드 종료 <Icon name="arrow" size={14} /></button>
        </div>
      </motion.header>

      <div className="relative z-10 overflow-x-auto p-4">
        <motion.section initial={{ opacity: 0, scale: 0.985, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} className="mx-auto min-w-[1260px] max-w-[1580px] overflow-hidden rounded-[28px] border border-[#dcd8e6] bg-white shadow-[0_24px_80px_rgba(52,42,85,0.14)]">
          <div className="grid h-[calc(100vh-126px)] min-h-[720px] grid-cols-[252px_minmax(700px,1fr)_278px] grid-rows-[minmax(0,1fr)_68px]">
            <aside className="min-h-0 overflow-y-auto border-r border-[#e6e3ed] bg-[#fbfaff]">
              <div className="border-b border-[#e8e5ef] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-[#7657ff] text-white shadow-[0_8px_20px_rgba(118,87,255,0.35)]"><Icon name="magic" size={16} /></span>
                  <div><h2 className="text-sm font-black">AI 가상 피팅</h2><p className="text-[10px] text-[#9691a0]">Style scene 01</p></div>
                </div>
              </div>
              <div className="space-y-4 p-3">
                <AvatarStage fittingItems={fittingItems} isGenerating={isGenerating} />
                <div>
                  <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a8494]">Fitting layers</p><span className="text-[10px] font-bold text-[#aaa5b2]">{fittingItems.length}/2</span></div>
                  <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => toggleFitting(event.dataTransfer.getData("text/plain"))} className="grid min-h-[92px] grid-cols-2 gap-2 rounded-[20px] border border-dashed border-[#d7d1e5] bg-white p-2">
                    {fittingItems.map((item) => <ClothingCard key={item.id} item={item} compact selected={selectedItem?.id === item.id} onSelect={setSelectedItem} onDragStart={handleDragStart} />)}
                    {fittingItems.length === 0 && <p className="col-span-2 self-center text-center text-[10px] font-semibold text-[#aaa4b4]">아이템을 이곳에 놓아보세요</p>}
                  </div>
                </div>
                <button type="button" onClick={handleGenerate} className="group flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#7657ff] px-4 py-3 text-xs font-black text-white shadow-[0_12px_30px_rgba(118,87,255,0.3)] transition hover:-translate-y-0.5 hover:bg-[#6546f2]">
                  <Icon name="magic" size={15} /> {isGenerating ? "생성 중..." : "아바타 생성하기"}
                </button>
                <div className="rounded-[20px] border border-[#e4e0eb] bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a8494]">Layers</p>
                  {["아바타 베이스", "가상 피팅", "피팅 후보"].map((layer, index) => (
                    <div key={layer} className="mt-2 flex items-center gap-2 rounded-xl px-2 py-2 text-[11px] font-bold text-[#5e5968] hover:bg-[#f4f1fa]">
                      <Icon name={index === 0 ? "users" : index === 1 ? "magic" : "layers"} size={14} /><span className="flex-1">{layer}</span><span className="size-2 rounded-full bg-[#d8d3e1]" />
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="relative min-h-0 overflow-y-auto bg-[#f5f3f8] p-5">
              <div className="sticky top-0 z-20 mx-auto mb-4 flex w-fit items-center gap-1 rounded-2xl border border-[#ded9e8] bg-white/95 p-1.5 shadow-[0_10px_35px_rgba(60,50,90,0.12)] backdrop-blur">
                <ToolButton icon="cursor" label="선택" active={activeTool === "cursor"} onClick={() => setActiveTool("cursor")} />
                <ToolButton icon="hand" label="이동" active={activeTool === "hand"} onClick={() => setActiveTool("hand")} />
                <span className="mx-1 h-5 w-px bg-[#e3dfea]" />
                <ToolButton icon="text" label="텍스트" active={activeTool === "text"} onClick={() => setActiveTool("text")} />
                <ToolButton icon="grid" label="프레임" active={activeTool === "grid"} onClick={() => setActiveTool("grid")} />
                <ToolButton icon="add" label="추가" active={false} />
              </div>

              <div className="mx-auto max-w-[940px]">
                <div className="mb-5 flex items-end justify-between gap-4 px-1">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7657ff]">Infinite style canvas</p><h1 className="mt-1 text-[28px] font-black tracking-[-0.04em]">오늘의 티어를 함께 완성하세요.</h1></div>
                  <div className="rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[#777181] shadow-sm">{clothes.length} items · 4 tiers</div>
                </div>

                <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveItem(event.dataTransfer.getData("text/plain"), null)} className="mb-3 rounded-[26px] border border-[#ded9e8] bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between px-1"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-[#f0edfa] text-[#7657ff]"><Icon name="layers" size={14} /></span><div><p className="text-xs font-black">티어 배정 대기</p><p className="text-[9px] text-[#9a95a3]">Uncategorized items</p></div></div><span className="rounded-full bg-[#f2eff7] px-2.5 py-1 text-[10px] font-black text-[#777181]">{waitingItems.length}</span></div>
                  <div className="grid min-h-[112px] grid-cols-7 items-center gap-2 rounded-[20px] bg-[#f7f5fa] p-2">
                    <AnimatePresence mode="popLayout">
                      {waitingItems.map((item) => <ClothingCard key={item.id} item={item} compact selected={selectedItem?.id === item.id} onSelect={setSelectedItem} onDragStart={handleDragStart} />)}
                    </AnimatePresence>
                    {waitingItems.length === 0 && <p className="col-span-7 text-center text-[11px] font-bold text-[#aaa5b2]">모든 아이템이 티어에 배정되었어요</p>}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {tiers.map((tier, tierIndex) => {
                    const color = tierColors[tierIndex % tierColors.length];
                    const isActive = activeTier === tier.id;
                    return (
                      <motion.div key={tier.id} layout onDragOver={(event) => { event.preventDefault(); setActiveTier(tier.id); }} onDragLeave={() => setActiveTier(null)} onDrop={(event) => moveItem(event.dataTransfer.getData("text/plain"), tier.id)} className={`grid min-h-[132px] grid-cols-[82px_minmax(0,1fr)] overflow-hidden rounded-[26px] border transition ${isActive ? "border-[#7657ff] bg-[#eeeaff] shadow-[0_0_0_4px_rgba(118,87,255,0.12)]" : "border-[#ded9e8] bg-white shadow-sm"}`}>
                        <div className={`flex flex-col items-center justify-center ${color.background} ${color.text}`}><span className="text-2xl font-black">{tier.name}</span><span className="mt-1 text-[9px] font-black uppercase tracking-widest opacity-60">Tier</span></div>
                        <div className="grid grid-cols-7 content-center gap-2 p-2.5">
                          <AnimatePresence mode="popLayout">
                            {tier.items.map((item) => <ClothingCard key={item.id} item={item} compact selected={selectedItem?.id === item.id} onSelect={setSelectedItem} onDragStart={handleDragStart} />)}
                          </AnimatePresence>
                          {tier.items.length === 0 && <div className="col-span-7 flex h-[94px] items-center justify-center rounded-[18px] border border-dashed border-[#dcd7e5] text-[10px] font-bold text-[#aaa5b2]">의상을 드래그해 이 티어에 추가하세요</div>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="min-h-0 overflow-y-auto border-l border-[#e6e3ed] bg-[#fbfaff]">
              <div className="sticky top-0 z-10 border-b border-[#e6e3ed] bg-[#fbfaff]/95 p-3 backdrop-blur">
                <div className="grid grid-cols-2 rounded-xl bg-[#efedf4] p-1">
                  {["design", "animate"].map((mode) => <button key={mode} type="button" onClick={() => setPanelMode(mode)} className={`rounded-lg px-3 py-2 text-[11px] font-black capitalize transition ${panelMode === mode ? "bg-white text-[#201d29] shadow-sm" : "text-[#8f8998]"}`}>{mode}</button>)}
                </div>
              </div>
              <AnimatePresence mode="wait">
                {panelMode === "design" ? (
                  <motion.div key="design" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4 p-3">
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#96909f]"><Icon name="search" size={15} /></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="의상 검색" className="w-full rounded-2xl border border-[#dfdbe7] bg-white py-2.5 pl-9 pr-3 text-xs font-semibold outline-none transition focus:border-[#7657ff]" /></div>
                    <div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a8494]">Assets</p><button type="button" className="text-[#7657ff]"><Icon name="add" size={15} /></button></div><div className="grid grid-cols-2 gap-2">{filteredClothes.map((item) => <ClothingCard key={item.id} item={item} compact selected={selectedItem?.id === item.id} onSelect={setSelectedItem} onDragStart={handleDragStart} />)}</div></div>
                    {selectedItem && <div className="rounded-[20px] border border-[#dfdbe7] bg-white p-3"><div className="flex items-start gap-3"><ClothingArtwork item={selectedItem} className="size-14 shrink-0 rounded-xl" /><div className="min-w-0"><p className="truncate text-xs font-black">{selectedItem.name}</p><p className="mt-1 text-[10px] font-semibold text-[#918b99]">{selectedItem.brand || "GORDI SELECT"}</p><p className="mt-2 text-[11px] font-black text-[#7657ff]">{Number(selectedItem.price ?? 0).toLocaleString()}원</p></div></div><button type="button" onClick={() => toggleFitting(selectedItem.id)} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-black transition ${fittingIds.includes(selectedItem.id) ? "bg-[#ffe9f6] text-[#a62b74]" : "bg-[#201d29] text-white"}`}><Icon name={fittingIds.includes(selectedItem.id) ? "check" : "add"} size={13} />{fittingIds.includes(selectedItem.id) ? "피팅 후보에서 제외" : "피팅 후보에 추가"}</button></div>}
                  </motion.div>
                ) : (
                  <motion.div key="animate" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3 p-3">
                    <div className="rounded-[20px] border border-[#dfdbe7] bg-white p-4"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-[#eeeaff] text-[#7657ff]"><Icon name="magic" size={15} /></span><div><p className="text-xs font-black">Board motion</p><p className="text-[9px] text-[#9b95a3]">Smart animate preset</p></div></div><div className="mt-4 space-y-3">{[["Duration", "0.6s"], ["Easing", "Spring"], ["Stagger", "0.08s"]].map(([label, value]) => <div key={label} className="flex items-center justify-between text-[11px]"><span className="font-semibold text-[#827c8b]">{label}</span><span className="rounded-lg bg-[#f2eff6] px-2 py-1 font-black">{value}</span></div>)}</div></div>
                    <button type="button" onClick={() => setIsPlaying(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7657ff] px-3 py-3 text-[11px] font-black text-white"><Icon name="play" size={13} /> 모션 미리보기</button>
                    <div className="rounded-[20px] border border-[#dfdbe7] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a8494]">Properties</p>{[35, 68, 48].map((width, index) => <div key={width} className="mt-3"><div className="mb-1 flex justify-between text-[9px] font-bold text-[#938d9d]"><span>{["Opacity", "Bounce", "Delay"][index]}</span><span>{width}%</span></div><div className="h-1.5 rounded-full bg-[#ece8f2]"><motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} className="h-full rounded-full bg-[#7657ff]" /></div></div>)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </aside>

            <div className="col-span-3"><Timeline participants={roomStatus.participants} isPlaying={isPlaying} onTogglePlay={() => setIsPlaying((current) => !current)} /></div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
