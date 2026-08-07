import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";
import TierMakerIcon from "@/components/tierMaker/TierMakerIcon";

const easeOut = [0.16, 1, 0.3, 1];

const clothes = {
  shirt: {
    id: "shirt",
    name: "블루 셔츠",
    artwork: "shirt",
    color: "text-sky-300",
    surface: "bg-sky-50",
  },
  pants: {
    id: "pants",
    name: "블랙 슬랙스",
    artwork: "pants",
    color: "text-slate-700",
    surface: "bg-slate-100",
  },
  knit: {
    id: "knit",
    name: "크림 니트",
    artwork: "knit",
    color: "text-amber-200",
    surface: "bg-amber-50",
  },
  jacket: {
    id: "jacket",
    name: "울 재킷",
    artwork: "jacket",
    color: "text-stone-500",
    surface: "bg-stone-100",
  },
  cardigan: {
    id: "cardigan",
    name: "그린 가디건",
    artwork: "cardigan",
    color: "text-emerald-300",
    surface: "bg-emerald-50",
  },
};

const tierRows = [
  {
    tier: "S",
    position: "left-[66px] top-[68px]",
    width: "w-[510px]",
    surface: "bg-[#fff4f2]/90 border-[#edcbc8]",
    label: "bg-[#f2b8b5] text-[#743b39]",
    items: [clothes.shirt, clothes.pants],
    delay: 0.34,
  },
  {
    tier: "A",
    position: "left-[102px] top-[156px]",
    width: "w-[505px]",
    surface: "bg-[#fff7ed]/90 border-[#efd8bf]",
    label: "bg-[#f5cca4] text-[#744c2e]",
    items: [clothes.knit],
    dropTarget: true,
    delay: 0.42,
  },
  {
    tier: "B",
    position: "left-[54px] top-[244px]",
    width: "w-[500px]",
    surface: "bg-[#fffbea]/90 border-[#eee1ae]",
    label: "bg-[#f4e3a8] text-[#655927]",
    items: [clothes.jacket],
    delay: 0.5,
  },
  {
    tier: "C",
    position: "left-[92px] top-[332px]",
    width: "w-[470px]",
    surface: "bg-[#f2f8ef]/90 border-[#d6e5d2]",
    label: "bg-[#cde3c8] text-[#3f6143]",
    items: [],
    delay: 0.58,
  },
];

const fittingImages = [
  { src: "/images/hero/1.jpg", alt: "블루 셔츠와 블랙 슬랙스 가상 피팅 결과" },
  { src: "/images/hero/2.jpg", alt: "블랙 니트와 데님 팬츠 가상 피팅 결과" },
];

function MiniClothing({ item }) {
  return (
    <motion.div
      whileHover={{ y: -5, rotate: -1.5, scale: 1.03 }}
      transition={{ duration: 0.24, ease: easeOut }}
      className="group relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-2xl border border-white bg-white shadow-[0_9px_22px_rgba(31,35,32,0.1)]"
    >
      <ClothingArtwork item={item} className="h-[42px] w-full transition-transform duration-300 group-hover:scale-105" />
      <p className="truncate border-t border-slate-100 px-1 py-1 text-center text-[7px] font-bold text-slate-600">
        {item.name}
      </p>
    </motion.div>
  );
}

function FloatingCursor({ label, color, labelColor, x, y, duration, delay = 0, draggedItem }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={reduceMotion ? { opacity: 1, x: x[0], y: y[0] } : { opacity: 1, x, y }}
      transition={
        reduceMotion
          ? { duration: 0.2 }
          : {
              opacity: { delay, duration: 0.28 },
              x: { delay, duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              y: { delay, duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
            }
      }
      className="pointer-events-none absolute left-0 top-0 z-50"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`block size-7 overflow-visible drop-shadow-[0_4px_5px_rgba(15,23,42,0.24)] ${color}`}
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
      <span className={`ml-4 -mt-0.5 block w-fit rounded-full px-2.5 py-1 text-[9px] font-bold text-white shadow-[0_5px_14px_rgba(15,23,42,0.2)] ring-2 ring-white/90 ${labelColor}`}>
        {label}
      </span>
      {draggedItem && (
        <div className="ml-4 mt-1.5 w-[54px] overflow-hidden rounded-2xl border-2 border-white bg-white shadow-[0_12px_28px_rgba(15,23,42,0.2)]">
          <ClothingArtwork item={draggedItem} className="h-[46px] w-full" />
          <p className="truncate px-1 py-1 text-center text-[7px] font-bold text-slate-600">
            {draggedItem.name}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function TierRibbon({ row }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: row.delay, duration: 0.62, ease: easeOut }}
      whileHover={{ x: 8, y: -3, rotate: 0.25 }}
      className={`absolute z-10 flex h-[74px] items-center overflow-hidden rounded-[25px] border backdrop-blur-md shadow-[0_14px_34px_rgba(31,35,32,0.1)] ${row.position} ${row.width} ${row.surface}`}
    >
      <div className={`flex h-full w-[66px] shrink-0 items-center justify-center text-lg font-black ${row.label}`}>
        {row.tier}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        {row.items.map((item) => (
          <MiniClothing key={item.id} item={item} />
        ))}
        {row.dropTarget && (
          <motion.div
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: [0.7, 1, 0.7], scale: [0.98, 1, 0.98] }}
            transition={{ delay: 0.9, duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-[54px] w-[68px] shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/[0.85] text-center text-[8px] font-bold text-violet-600"
          >
            여기에 놓기
          </motion.div>
        )}
        {row.items.length === 0 && (
          <div className="flex h-[46px] flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300/60 text-[8px] font-medium text-slate-400">
            다음 의상을 기다리고 있어요
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FittingPolaroid() {
  const [fittingIndex, setFittingIndex] = useState(0);
  const nextIndex = fittingIndex === 0 ? 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, rotate: 5 }}
      animate={{ opacity: 1, y: 0, rotate: 3 }}
      transition={{ delay: 0.62, duration: 0.66, ease: easeOut }}
      whileHover={{ y: -7, rotate: 1 }}
      className="absolute right-2 top-[84px] z-30 h-[286px] w-[180px]"
    >
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-6 overflow-hidden rounded-[26px] border-[6px] border-white bg-white shadow-[0_18px_42px_rgba(31,35,32,0.14)]">
        <img
          src={fittingImages[nextIndex].src}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center opacity-70"
        />
      </div>
      <button
        type="button"
        onClick={() => setFittingIndex(nextIndex)}
        className="absolute inset-0 overflow-hidden rounded-[26px] border-[6px] border-white bg-white text-left shadow-[0_22px_54px_rgba(31,35,32,0.2)] transition-shadow hover:shadow-[0_28px_62px_rgba(31,35,32,0.24)]"
        aria-label="다른 가상 피팅 결과 보기"
      >
        <div className="relative h-[226px] overflow-hidden bg-[#f3f3f1]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={fittingImages[fittingIndex].src}
              src={fittingImages[fittingIndex].src}
              alt={fittingImages[fittingIndex].alt}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.38, ease: easeOut }}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </AnimatePresence>
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1.5 text-[8px] font-bold text-white shadow-md">
            <TierMakerIcon name="sparkles" size={11} />
            피팅 완료
          </span>
        </div>
        <div className="flex h-[48px] items-center justify-between px-3">
          <span>
            <strong className="block text-[9px] text-slate-800">AI 가상 피팅</strong>
            <span className="mt-0.5 block text-[7px] text-slate-400">눌러서 결과 비교</span>
          </span>
          <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">↻</span>
        </div>
      </button>
    </motion.div>
  );
}

function OrganicTierCollaborationScene({ className = "" }) {
  return (
    <div className={`relative h-[470px] w-[780px] shrink-0 ${className}`}>
      <div aria-hidden="true" className="absolute left-5 top-12 h-48 w-48 rounded-full bg-violet-200/45 blur-2xl" />
      <div aria-hidden="true" className="absolute right-10 top-10 h-52 w-52 rounded-full bg-emerald-200/45 blur-2xl" />
      <div aria-hidden="true" className="absolute bottom-2 left-[250px] h-36 w-60 rounded-full bg-orange-200/40 blur-2xl" />

      {tierRows.map((row) => (
        <TierRibbon key={row.tier} row={row} />
      ))}

      <FittingPolaroid />

      <FloatingCursor
        label="민지"
        color="text-blue-600"
        labelColor="bg-blue-600"
        x={[182, 250, 338]}
        y={[34, 98, 180]}
        duration={5.4}
        delay={0.72}
        draggedItem={clothes.cardigan}
      />
      <FloatingCursor
        label="나"
        color="text-violet-600"
        labelColor="bg-violet-600"
        x={[274, 342, 314]}
        y={[88, 126, 82]}
        duration={4.6}
        delay={0.48}
      />
      <FloatingCursor
        label="유리"
        color="text-rose-500"
        labelColor="bg-rose-500"
        x={[498, 548, 520]}
        y={[258, 318, 240]}
        duration={4.9}
        delay={1.02}
      />
    </div>
  );
}

export default OrganicTierCollaborationScene;
