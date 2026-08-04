import { useQuery } from "@tanstack/react-query";

import { getMyResults } from "@/api/users";
import { getApiErrorMessage } from "@/utils/apiError";

function formatDate(createdAt) {
    return createdAt ? createdAt.slice(0, 10).replaceAll("-", ". ") : "날짜 없음";
}

export default function HistoryTab() {
    const resultsQuery = useQuery({ queryKey: ["myResults"], queryFn: getMyResults, retry: false });
    const results = resultsQuery.data?.data?.items ?? resultsQuery.data?.items ?? [];

    if (resultsQuery.isPending) {
        return <div className="space-y-5">{[0, 1].map((item) => <div key={item} className="h-72 animate-pulse rounded-lg bg-slate-100" />)}</div>;
    }

    if (resultsQuery.isError) {
        return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{getApiErrorMessage(resultsQuery.error, "티어메이커 결과를 불러오지 못했습니다.")}</p>;
    }

    return (
        <section className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold">내 결과</h1>
                    <p className="mt-1 text-slate-400">완료한 티어메이커의 상위 의상을 확인할 수 있습니다.</p>
                </div>
                <small className="text-slate-400">총 {results.length}개 결과</small>
            </div>

            {results.length === 0 ? (
                <p className="mt-8 rounded-lg bg-slate-50 px-5 py-12 text-center text-sm text-slate-400">아직 완료한 티어메이커 결과가 없습니다.</p>
            ) : (
                <div className="mt-8 space-y-5">
                    {results.map((result) => (
                        <article key={result.resultId} className="rounded-lg border border-slate-100 p-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-400">ROOM {result.roomCode}</p>
                                    <h2 className="mt-1 text-xl font-bold">{formatDate(result.createdAt)}</h2>
                                </div>
                                <button type="button" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">자세히 보기</button>
                            </div>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {(result.topItems ?? []).map((topItem, index) => (
                                    <div key={topItem.productId} className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                                        <div className="relative flex aspect-square items-center justify-center bg-white">
                                            <span className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">{topItem.rank ?? index + 1}위</span>
                                            {topItem.imageUrl ? (
                                                <img src={topItem.imageUrl} alt={topItem.name ?? `상품 #${topItem.productId}`} className="h-full w-full object-contain" />
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
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
