import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";

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
  sneakers: {
    id: "sneakers",
    name: "화이트 스니커즈",
    artwork: "sneakers",
    color: "text-slate-300",
    surface: "bg-slate-50",
  },
};

const tierRows = [
  {
    name: "S",
    tone: "bg-[#f2b8b5] text-[#743b39]",
    items: [clothes.shirt, clothes.pants],
  },
  {
    name: "A",
    tone: "bg-[#f5cca4] text-[#744c2e]",
    items: [clothes.knit],
    dropTarget: true,
  },
  {
    name: "B",
    tone: "bg-[#f4e3a8] text-[#655927]",
    items: [clothes.jacket],
  },
  {
    name: "C",
    tone: "bg-[#cde3c8] text-[#3f6143]",
    items: [],
  },
];

const fittingImages = [
  { src: "/images/hero/1.jpg", alt: "블루 셔츠와 블랙 슬랙스 가상 피팅 결과" },
  { src: "/images/hero/2.jpg", alt: "블랙 니트와 데님 팬츠 가상 피팅 결과" },
];

function Highlight({ children, color, delay }) {
  return (
    <span className="relative isolate inline-block px-1 font-extrabold">
      {children}
      <motion.span
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay, duration: 0.72, ease: easeOut }}
        className={`absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.24em] origin-left rounded-full ${color}`}
      />
    </span>
  );
}

function ClothingTile({ item, delay = 0, compact = false, lockedBy }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.86, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: easeOut }}
      whileHover={{ y: -4, rotate: -1 }}
      className={`group relative shrink-0 overflow-hidden rounded-xl border bg-white shadow-[0_7px_18px_rgba(15,23,42,0.08)] ${lockedBy ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"} ${compact ? "w-[54px]" : "w-[62px]"}`}
    >
      {lockedBy && (
        <span className="absolute inset-x-1 top-1 z-10 truncate rounded-full bg-blue-600 px-1.5 py-0.5 text-center text-[6px] font-bold text-white shadow-sm">
          {lockedBy}
        </span>
      )}
      <ClothingArtwork
        item={item}
        className={`${compact ? "h-[39px]" : "h-[45px]"} w-full transition-transform duration-300 group-hover:scale-105`}
      />
      <p className="truncate border-t border-slate-100 px-1.5 py-1 text-center text-[8px] font-bold text-slate-600">
        {item.name}
      </p>
    </motion.div>
  );
}

function CollaborationCursor({ label, color, labelColor, x, y, duration, delay = 0, draggedItem }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={reduceMotion ? { opacity: 1, x: x[0], y: y[0] } : { opacity: 1, x, y }}
      transition={
        reduceMotion
          ? { duration: 0.2 }
          : {
              opacity: { delay, duration: 0.25 },
              x: { delay, duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              y: { delay, duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
            }
      }
      className="pointer-events-none absolute left-0 top-0 z-40"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`block size-6 overflow-visible drop-shadow-[0_3px_4px_rgba(15,23,42,0.22)] ${color}`}
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
      <span className={`ml-4 -mt-0.5 block w-fit rounded-full px-2.5 py-1 text-[9px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)] ring-2 ring-white/90 ${labelColor}`}>
        {label}
      </span>
      {draggedItem && (
        <div className="ml-4 mt-1.5 w-[50px] overflow-hidden rounded-xl border-2 border-white bg-white shadow-xl">
          <ClothingArtwork item={draggedItem} className="h-[43px] w-full" />
          <p className="truncate px-1 py-1 text-center text-[7px] font-bold text-slate-600">
            {draggedItem.name}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function CollaborationBoard() {
  const [fittingIndex, setFittingIndex] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 34, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay: 0.12, duration: 0.86, ease: easeOut }}
      whileHover={{ y: -4 }}
      className="relative h-[600px] w-[760px]"
    >
      <div aria-hidden="true" className="absolute -right-3 top-16 h-[92px] w-28 rounded-r-[28px] bg-[#F6DCA5]" />
      <div aria-hidden="true" className="absolute -right-5 top-[174px] h-[92px] w-32 rounded-r-[28px] bg-[#CFE2CE]" />
      <div aria-hidden="true" className="absolute -right-7 top-[282px] h-[92px] w-36 rounded-r-[28px] bg-[#D9E0CD]" />
      <div aria-hidden="true" className="absolute -right-9 top-[390px] h-[92px] w-40 rounded-r-[28px] bg-[#DCDDD9]" />

      <section className="absolute left-0 top-0 z-10 h-[580px] w-[730px] overflow-hidden rounded-[38px] border-[7px] border-white bg-white shadow-[0_34px_82px_rgba(31,35,32,0.2)]">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-100 px-5">
          <div>
            <h2 className="text-[15px] font-black tracking-[-0.02em] text-slate-900">
              함께 만드는 오늘의 티어
            </h2>
            <p className="mt-1 text-[10px] font-medium text-slate-400">
              의상을 옮기면 모든 참여자 화면에 바로 반영돼요
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-[9px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-100">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              3명 함께 편집 중
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-2 text-[9px] font-bold text-white">
              <TierMakerIcon name="mic" size={12} />
              음성 연결됨
            </span>
          </div>
        </header>

        <div className="grid h-[424px] grid-cols-[minmax(0,1fr)_158px] gap-3 p-3">
          <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/70">
            <div className="border-b border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] font-black text-slate-800">티어 배정 대기</h3>
                  <p className="mt-0.5 text-[8px] text-slate-400">끌어서 원하는 등급에 놓아보세요</p>
                </div>
                <span className="rounded-full bg-violet-50 px-2 py-1 text-[8px] font-bold text-violet-600">2개</span>
              </div>
              <div className="mt-2 flex h-[66px] items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2">
                <ClothingTile item={clothes.cardigan} compact delay={0.38} lockedBy="민지 이동 중" />
                <ClothingTile item={clothes.sneakers} compact delay={0.46} />
                <span className="ml-auto pr-2 text-[8px] font-medium text-slate-300">여기로 의상을 모아두세요</span>
              </div>
            </div>

            <div className="p-2.5">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {tierRows.map((tier, rowIndex) => (
                  <div
                    key={tier.name}
                    className="flex h-[67px] border-b border-slate-200 bg-white last:border-b-0"
                  >
                    <div className={`flex w-[54px] shrink-0 items-center justify-center text-sm font-black ${tier.tone}`}>
                      {tier.name}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
                      {tier.items.map((item, itemIndex) => (
                        <ClothingTile
                          key={item.id}
                          item={item}
                          compact
                          delay={0.5 + rowIndex * 0.07 + itemIndex * 0.05}
                        />
                      ))}
                      {tier.dropTarget && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: [0.72, 1, 0.72], scale: [0.98, 1, 0.98] }}
                          transition={{ delay: 0.9, duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                          className="flex h-[50px] w-[54px] shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 text-center text-[7px] font-bold text-violet-500"
                        >
                          여기에
                          <br />
                          놓기
                        </motion.span>
                      )}
                      {tier.items.length === 0 && !tier.dropTarget && (
                        <span className="flex h-10 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[8px] text-slate-300">
                          여기에 놓기
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <CollaborationCursor
              label="민지"
              color="text-blue-600"
              labelColor="bg-blue-600"
              x={[332, 280, 238]}
              y={[92, 150, 208]}
              duration={5.2}
              delay={0.8}
              draggedItem={clothes.cardigan}
            />
            <CollaborationCursor
              label="나"
              color="text-violet-600"
              labelColor="bg-violet-600"
              x={[150, 204, 185]}
              y={[250, 230, 254]}
              duration={4.4}
              delay={0.48}
            />
            <CollaborationCursor
              label="유리"
              color="text-rose-500"
              labelColor="bg-rose-500"
              x={[386, 350, 398]}
              y={[326, 345, 300]}
              duration={4.8}
              delay={1.1}
            />
          </div>

          <aside className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <div>
                <h3 className="text-[10px] font-black text-slate-800">AI 가상 피팅</h3>
                <p className="mt-0.5 text-[8px] text-slate-400">완성한 코디 미리보기</p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <TierMakerIcon name="sparkles" size={13} />
              </span>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f5f5f3]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={fittingImages[fittingIndex].src}
                  src={fittingImages[fittingIndex].src}
                  alt={fittingImages[fittingIndex].alt}
                  initial={{ opacity: 0, scale: 1.025 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.38, ease: easeOut }}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </AnimatePresence>
              <span className="absolute left-2 top-2 rounded-full border border-white/70 bg-white/85 px-2 py-1 text-[7px] font-bold text-slate-600 shadow-sm backdrop-blur">
                피팅 완료
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-[8px] font-bold text-slate-500">결과 비교</span>
              <div className="flex gap-1.5">
                {fittingImages.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => setFittingIndex(index)}
                    aria-label={`${index + 1}번 가상 피팅 결과 보기`}
                    aria-pressed={fittingIndex === index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${fittingIndex === index ? "w-5 bg-violet-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                  />
                ))}
              </div>
            </div>
          </aside>
        </div>

        <footer className="mx-3 flex h-[72px] items-center justify-between border-t border-slate-100 px-2">
          <div className="flex items-center gap-2">
            {[
              ["나", "방장", "bg-violet-100 text-violet-700"],
              ["민지", "참여자", "bg-blue-100 text-blue-700"],
              ["유리", "참여자", "bg-rose-100 text-rose-700"],
            ].map(([name, role, color]) => (
              <div key={name} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-2.5 py-2">
                <span className={`relative flex size-8 items-center justify-center rounded-full text-[9px] font-black ${color}`}>
                  {name.slice(0, 2)}
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-400" />
                </span>
                <span>
                  <strong className="block text-[9px] text-slate-700">{name}</strong>
                  <span className="mt-0.5 block text-[7px] text-slate-400">{role}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 items-center gap-2 rounded-full bg-slate-900 px-3 text-[8px] font-bold text-white">
              <TierMakerIcon name="mic" size={13} />
              대화 중
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <TierMakerIcon name="speaker" size={14} />
            </span>
          </div>
        </footer>
      </section>
    </motion.div>
  );
}

function MainHeroCollaborationDesignPage() {
  return (
    <div className="min-h-[calc(100vh-6rem)] min-w-[1180px] overflow-hidden bg-[#F3F3EF] font-sans text-[#202421]">
      <section className="relative flex min-h-[760px] items-center px-12 py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(31,35,32,0.08) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to right, black, transparent 48%, transparent)",
          }}
        />
        <div aria-hidden="true" className="absolute -left-36 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-white/75 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-[1360px] grid-cols-[500px_760px] items-center gap-[76px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease: easeOut }}
            className="relative z-20"
          >
            <h1 className="text-[62px] font-thin leading-[1.07] tracking-[-0.055em] text-[#202421]">
              나만의 <Highlight color="bg-[#D9CDF8]" delay={0.44}>아바타</Highlight>로
              <br />
              친구들과 <Highlight color="bg-[#BFE7D2]" delay={0.58}>함께</Highlight>
              <br />
              의상 <Highlight color="bg-[#F8D4BF]" delay={0.72}>티어메이커</Highlight>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.62, ease: easeOut }}
              className="mt-7 max-w-[470px] text-[16px] font-medium leading-8 text-[#666D67]"
            >
              친구의 커서와 선택을 실시간으로 확인하며 의상을 함께 배치하고,
              완성한 코디는 AI 가상 피팅으로 바로 비교해보세요.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.58, ease: easeOut }}
              className="mt-9 flex items-center gap-5"
            >
              <Link
                to="/rooms"
                className="group flex h-[58px] items-center gap-7 rounded-full bg-[#242925] px-7 text-[15px] font-semibold text-white shadow-[0_18px_38px_rgba(31,35,32,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_23px_44px_rgba(31,35,32,0.25)]"
              >
                친구들과 시작하기
                <span aria-hidden="true" className="text-xl transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.54, duration: 0.55, ease: easeOut }}
              className="mt-8 flex items-center gap-3 text-[12px] font-semibold text-[#6F766F]"
            >
              <div className="flex -space-x-2">
                {["나", "민", "유"].map((name, index) => (
                  <span
                    key={name}
                    className={`flex size-9 items-center justify-center rounded-full border-2 border-[#F3F3EF] text-[9px] font-black ${["bg-violet-200 text-violet-800", "bg-blue-200 text-blue-800", "bg-rose-200 text-rose-800"][index]}`}
                  >
                    {name}
                  </span>
                ))}
              </div>
              <span className="flex items-center gap-2">
                <TierMakerIcon name="mic" size={14} />
                음성으로 대화하며 같은 보드를 편집해요
              </span>
            </motion.div>
          </motion.div>

          <CollaborationBoard />
        </div>
      </section>
    </div>
  );
}

export default MainHeroCollaborationDesignPage;
