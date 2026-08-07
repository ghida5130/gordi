import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import { getMyResults } from "@/api/users";
import StatusPanel from "@/components/common/StatusPanel";
import SurfaceCard from "@/components/common/SurfaceCard";
import { getApiErrorMessage } from "@/utils/apiError";

function formatDate(createdAt) {
    return createdAt ? createdAt.slice(0, 10).replaceAll("-", ". ") : "날짜 없음";
}

export default function HistoryTab() {
    const resultsQuery = useQuery({ queryKey: ["myResults"], queryFn: getMyResults, retry: false });
    const results = resultsQuery.data?.data?.items ?? resultsQuery.data?.items ?? [];

    if (resultsQuery.isPending) {
        return <div className="space-y-5">{[0, 1].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl bg-slate-100" />)}</div>;
    }

    if (resultsQuery.isError) {
        return <StatusPanel tone="danger" role="alert">{getApiErrorMessage(resultsQuery.error, "티어메이커 결과를 불러오지 못했습니다.")}</StatusPanel>;
    }

    return (
        <section className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between px-1">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">내 티어메이커 결과</h1>
                    <p className="mt-2 text-sm text-slate-500">완료한 보드와 높은 순위를 받은 의상을 다시 확인해 보세요.</p>
                </div>
                <small className="rounded-full bg-white px-4 py-2 font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">총 {results.length}개 결과</small>
            </div>

            {results.length === 0 ? (
                <SurfaceCard className="mt-8 px-5 py-16 text-center text-sm text-slate-500">아직 완료한 티어메이커 결과가 없습니다.</SurfaceCard>
            ) : (
                <div className="mt-8 space-y-5">
                    {results.map((result) => (
                        <motion.article
                            key={result.resultId}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -2 }}
                            className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600">Room {result.roomCode}</p>
                                    <h2 className="mt-2 text-xl font-black">{formatDate(result.createdAt)}</h2>
                                </div>
                                <Link
                                    to={`/rooms/${encodeURIComponent(result.roomCode)}/result`}
                                    className="group rounded-full bg-slate-950 px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-violet-600"
                                >
                                    자세히 보기 <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
                                </Link>
                            </div>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {(result.topItems ?? []).map((topItem, index) => (
                                    <div key={topItem.productId} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-violet-200 hover:shadow-[0_12px_30px_rgba(124,58,237,0.08)]">
                                        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-white">
                                            <span className="absolute left-3 top-3 z-10 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white">{topItem.rank ?? index + 1}위</span>
                                            {topItem.imageUrl ? (
                                                <img src={topItem.imageUrl} alt={topItem.name ?? `상품 #${topItem.productId}`} className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.035]" />
                                            ) : (
                                                <span className="text-xs text-slate-400">상품 이미지 없음</span>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <p className="font-bold text-slate-900">{topItem.name ?? `상품 #${topItem.productId}`}</p>
                                            <p className="mt-1 text-sm text-slate-500">{topItem.brand ?? "브랜드 정보 없음"}</p>
                                            <p className="mt-2 text-sm font-bold text-slate-900">
                                                {topItem.price != null
                                                    ? `${Number(topItem.price).toLocaleString()}원`
                                                    : "가격 정보 없음"}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.article>
                    ))}
                </div>
            )}
        </section>
    );
}
