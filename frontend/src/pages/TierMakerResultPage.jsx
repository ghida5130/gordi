import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams } from "react-router-dom";

import { getRoomResult } from "@/api/rooms";
import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";
import ClothingDetailButton from "@/components/tierMaker/ClothingDetailButton";
import FittingImagePreviewModal from "@/components/tierMaker/FittingImagePreviewModal";
import TierMakerIcon from "@/components/tierMaker/TierMakerIcon";
import ResultProductDetailModal from "@/components/tierMakerResult/ResultProductDetailModal";
import { getApiErrorMessage } from "@/utils/apiError";
import { getRoomSession } from "@/utils/roomSessionStorage";

const TIER_STYLES = [
  "bg-[#f2b8b5] text-[#743b39]",
  "bg-[#f5cca4] text-[#744c2e]",
  "bg-[#f4e3a8] text-[#655927]",
  "bg-[#cde3c8] text-[#3f6143]",
  "bg-[#dbe1e8] text-[#46515e]",
];

function formatDate(createdAt) {
  if (!createdAt) return "완료 시간 정보 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getTierKey(tier) {
  return tier?.tierId == null
    ? `unknown:${tier?.tierName ?? "미분류"}`
    : String(tier.tierId);
}

function groupItemsByTier(tiers, items) {
  const tierMap = new Map();

  tiers.forEach((tier) => {
    tierMap.set(getTierKey(tier), {
      tierId: tier.tierId,
      tierName: tier.tierName ?? "미분류",
      position: tier.position,
      items: [],
    });
  });

  items.forEach((item) => {
    const tierId = item.tier?.tierId;
    const key = getTierKey(item.tier);
    const current = tierMap.get(key) ?? {
      tierId,
      tierName: item.tier?.tierName ?? "미분류",
      position: null,
      items: [],
    };

    current.items.push({ ...item, surface: "bg-slate-100" });
    tierMap.set(key, current);
  });

  return [...tierMap.values()]
    .sort((left, right) => {
      if (left.position != null && right.position != null) {
        const positionDifference =
          Number(left.position) - Number(right.position);
        if (positionDifference !== 0) return positionDifference;
      }
      if (left.position == null && right.position != null) return 1;
      if (left.position != null && right.position == null) return -1;
      if (left.tierId == null && right.tierId == null) {
        return left.tierName.localeCompare(right.tierName, "ko");
      }
      if (left.tierId == null) return 1;
      if (right.tierId == null) return -1;
      return Number(left.tierId) - Number(right.tierId);
    })
    .map((tier) => ({
      ...tier,
      items: tier.items.sort(
        (left, right) =>
          Number(left.position) - Number(right.position) ||
          Number(left.rank) - Number(right.rank),
      ),
    }));
}

function ResultSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-28 rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.05)]" />
      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[520px] rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.05)]" />
        <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.05)]">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-32 rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TierMakerResultPage() {
  const { roomCode: roomCodeParam } = useParams();
  const roomCode = String(roomCodeParam ?? "")
    .trim()
    .toUpperCase();
  const [roomSession] = useState(getRoomSession);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isFittingImagePreviewOpen, setIsFittingImagePreviewOpen] =
    useState(false);
  const roomToken =
    String(roomSession?.roomCode ?? "").toUpperCase() === roomCode
      ? roomSession?.roomToken
      : null;
  const resultQuery = useQuery({
    queryKey: ["roomResult", roomCode, Boolean(roomToken)],
    queryFn: () => getRoomResult({ roomCode, roomToken }),
    enabled: Boolean(roomCode),
    retry: false,
  });
  const result = resultQuery.data?.data;
  const tierGroups = useMemo(
    () =>
      groupItemsByTier(
        Array.isArray(result?.tiers) ? result.tiers : [],
        Array.isArray(result?.topItems) ? result.topItems : [],
      ),
    [result],
  );

  if (resultQuery.isPending) return <ResultSkeleton />;

  if (resultQuery.isError) {
    return (
      <main className="relative min-h-[calc(100vh-6rem)] overflow-hidden px-4 py-16">
        <motion.section
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-lg rounded-[28px] border border-red-100 bg-white p-9 text-center shadow-[0_22px_65px_rgba(15,23,42,0.1)]"
        >
          <span className="mx-auto flex size-13 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </span>
          <h1 className="mt-5 text-2xl font-black text-slate-950">
            결과를 확인할 수 없습니다
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {getApiErrorMessage(
              resultQuery.error,
              "티어메이커 결과를 불러오지 못했습니다.",
            )}
          </p>
          <Link
            to="/mypage"
            state={{ activeTab: "history" }}
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            내 결과로 돌아가기
            <span aria-hidden="true">→</span>
          </Link>
        </motion.section>
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(100vh-6rem)] overflow-hidden pb-16 text-slate-950">
      <div className="relative mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center justify-between gap-5 rounded-[28px] border border-slate-200 bg-white px-7 py-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                완료된 보드
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              공동 티어메이커 결과
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {result?.roomCode ?? roomCode} · {formatDate(result?.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/mypage"
              state={{ activeTab: "history" }}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
            >
              내 결과 보기
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              메인으로 돌아가기
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </motion.header>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.06,
              duration: 0.38,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)] xl:sticky xl:top-24"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                  aria-hidden="true"
                >
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                  <path d="m5.64 5.64 2.12 2.12M16.24 16.24l2.12 2.12M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <div>
                <h2 className="font-black">최종 가상 피팅</h2>
              </div>
            </div>
            <div className="p-4">
              <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-slate-100 shadow-inner">
                {result?.snapshotImageUrl ? (
                  <>
                    <img
                      src={result.snapshotImageUrl}
                      alt="최종 가상 피팅 결과"
                      className="max-h-[560px] w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setIsFittingImagePreviewOpen(true)}
                      className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-xl border border-white/80 bg-slate-950/75 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-slate-950"
                      aria-label="최종 가상 피팅 결과 크게 보기"
                    >
                      <TierMakerIcon name="focus" size={18} />
                    </button>
                  </>
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center px-6 text-center text-sm leading-6 text-slate-400">
                    저장된 가상 피팅 결과 이미지가 없습니다.
                  </div>
                )}
              </div>
              {Array.isArray(result?.fitSummary) &&
                result.fitSummary.length > 0 && (
                  <ul className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                    {result.fitSummary.map((summary, index) => (
                      <li key={`${summary}-${index}`}>• {summary}</li>
                    ))}
                  </ul>
                )}
              {result?.disclaimer && (
                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                  {result.disclaimer}
                </p>
              )}
            </div>
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.1,
              duration: 0.38,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                    aria-hidden="true"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18M9 9h12M9 15h12" />
                  </svg>
                </span>
                <div>
                  <h2 className="font-black text-slate-900">티어메이커</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    최종 확정된 의상 티어메이커 결과입니다.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                총 {result?.topItems?.length ?? 0}개
              </span>
            </div>

            <div className="p-4">
              {tierGroups.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  {tierGroups.map((tier, tierIndex) => (
                    <div
                      key={tier.tierId ?? tier.tierName}
                      className="flex min-h-[148px] border-b border-slate-200 bg-slate-50/60 last:border-b-0"
                    >
                      <div
                        className={`flex w-28 shrink-0 items-center justify-center px-3 text-center text-base font-black leading-5 sm:w-32 ${TIER_STYLES[tierIndex % TIER_STYLES.length]}`}
                      >
                        <span className="break-all">{tier.tierName}</span>
                      </div>
                      <div className="grid min-w-0 flex-1 grid-cols-3 content-center gap-2 p-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                        {tier.items.map((item, itemIndex) => (
                          <motion.article
                            key={item.roomItemId ?? item.productId}
                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              delay: Math.min(
                                (tierIndex * 3 + itemIndex) * 0.025,
                                0.28,
                              ),
                              duration: 0.24,
                            }}
                            whileHover={{ y: -3, rotate: 0.35 }}
                            className="group relative mx-auto aspect-square w-full max-w-[118px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-violet-300 hover:shadow-md"
                          >
                            <ClothingArtwork
                              item={item}
                              className="size-full"
                            />
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-950/90 px-2 py-0.5 text-[9px] font-black text-white shadow-sm">
                              {item.rank}위
                            </span>
                            <ClothingDetailButton
                              item={item}
                              onViewDetails={setSelectedItem}
                              className="inset-x-2 bottom-2"
                            />
                          </motion.article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  결과에 포함된 티어 의상이 없습니다.
                </div>
              )}
            </div>
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <ResultProductDetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>
      <FittingImagePreviewModal
        isOpen={isFittingImagePreviewOpen}
        imageUrl={result?.snapshotImageUrl}
        imageAlt="최종 가상 피팅 결과"
        onClose={() => setIsFittingImagePreviewOpen(false)}
      />
    </main>
  );
}
