import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams } from "react-router-dom";

import { getRoomResult } from "@/api/rooms";
import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";
import ClothingDetailButton from "@/components/tierMaker/ClothingDetailButton";
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

function groupItemsByTier(items) {
  const tierMap = new Map();

  items.forEach((item) => {
    const tierId = item.tier?.tierId;
    const key = tierId == null ? `unknown:${item.tier?.tierName ?? "미분류"}` : String(tierId);
    const current = tierMap.get(key) ?? {
      tierId,
      tierName: item.tier?.tierName ?? "미분류",
      items: [],
    };

    current.items.push({ ...item, surface: "bg-slate-100" });
    tierMap.set(key, current);
  });

  return [...tierMap.values()]
    .sort((left, right) => {
      if (left.tierId == null && right.tierId == null) {
        return left.tierName.localeCompare(right.tierName, "ko");
      }
      if (left.tierId == null) return 1;
      if (right.tierId == null) return -1;
      return Number(left.tierId) - Number(right.tierId);
    })
    .map((tier) => ({
      ...tier,
      items: tier.items.sort((left, right) =>
        Number(left.position) - Number(right.position) || Number(left.rank) - Number(right.rank)),
    }));
}

function ResultSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-28 rounded-3xl bg-slate-200" />
      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[520px] rounded-3xl bg-slate-200" />
        <div className="space-y-3 rounded-3xl bg-white p-5">
          {[0, 1, 2, 3].map((row) => <div key={row} className="h-32 rounded-2xl bg-slate-100" />)}
        </div>
      </div>
    </div>
  );
}

export default function TierMakerResultPage() {
  const { roomCode: roomCodeParam } = useParams();
  const roomCode = String(roomCodeParam ?? "").trim().toUpperCase();
  const [roomSession] = useState(getRoomSession);
  const [selectedItem, setSelectedItem] = useState(null);
  const roomToken = String(roomSession?.roomCode ?? "").toUpperCase() === roomCode
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
    () => groupItemsByTier(Array.isArray(result?.topItems) ? result.topItems : []),
    [result],
  );

  if (resultQuery.isPending) return <ResultSkeleton />;

  if (resultQuery.isError) {
    return (
      <main className="min-h-[calc(100vh-6rem)] px-4 py-16">
        <section className="mx-auto max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <p className="text-sm font-bold text-red-500">RESULT ERROR</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">결과를 확인할 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {getApiErrorMessage(resultQuery.error, "티어메이커 결과를 불러오지 못했습니다.")}
          </p>
          <Link to="/mypage" state={{ activeTab: "history" }} className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
            내 결과로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16 text-slate-950">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">완료된 보드</span>
              <span className="text-xs font-bold text-slate-400">VERSION {result?.boardVersion ?? "-"}</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">공동 티어메이커 결과</h1>
            <p className="mt-1 text-sm text-slate-500">ROOM {result?.roomCode ?? roomCode} · {formatDate(result?.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/mypage" state={{ activeTab: "history" }} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
              내 결과 보기
            </Link>
            <Link to="/" className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
              메인으로 돌아가기
            </Link>
          </div>
        </header>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)] xl:sticky xl:top-24">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-bold text-violet-600">AI VIRTUAL FITTING</p>
              <h2 className="mt-1 font-black">최종 가상 피팅</h2>
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-2xl bg-slate-100">
                {result?.snapshotImageUrl ? (
                  <img src={result.snapshotImageUrl} alt="최종 가상 피팅 결과" className="max-h-[560px] w-full object-contain" />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center px-6 text-center text-sm leading-6 text-slate-400">
                    저장된 가상 피팅 결과 이미지가 없습니다.
                  </div>
                )}
              </div>
              {Array.isArray(result?.fitSummary) && result.fitSummary.length > 0 && (
                <ul className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                  {result.fitSummary.map((summary, index) => <li key={`${summary}-${index}`}>• {summary}</li>)}
                </ul>
              )}
              {result?.disclaimer && <p className="mt-3 text-[11px] leading-5 text-slate-400">{result.disclaimer}</p>}
            </div>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-black text-slate-900">오늘의 티어</h2>
                <p className="mt-1 text-xs text-slate-500">최종 확정된 의상 배치입니다.</p>
              </div>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">총 {result?.topItems?.length ?? 0}개</span>
            </div>

            <div className="p-4">
              {tierGroups.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  {tierGroups.map((tier, tierIndex) => (
                    <div key={tier.tierId ?? tier.tierName} className="flex min-h-[148px] border-b border-slate-200 bg-slate-50/70 last:border-b-0">
                      <div className={`flex w-28 shrink-0 items-center justify-center px-3 text-center text-base font-black leading-5 sm:w-32 ${TIER_STYLES[tierIndex % TIER_STYLES.length]}`}>
                        <span className="break-all">{tier.tierName}</span>
                      </div>
                      <div className="grid min-w-0 flex-1 grid-cols-3 content-center gap-2 p-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                        {tier.items.map((item) => (
                          <motion.article
                            key={item.roomItemId ?? item.productId}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="group relative mx-auto aspect-square w-full max-w-[118px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
                          >
                            <ClothingArtwork item={item} className="size-full" />
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-950/85 px-2 py-0.5 text-[9px] font-black text-white">{item.rank}위</span>
                            <ClothingDetailButton item={item} onViewDetails={setSelectedItem} className="inset-x-2 bottom-2" />
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
          </section>
        </div>
      </div>

      <AnimatePresence>
        {selectedItem && <ResultProductDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
    </main>
  );
}
