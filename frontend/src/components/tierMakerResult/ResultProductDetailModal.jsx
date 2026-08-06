import { useEffect } from "react";
import { motion } from "motion/react";

function formatPrice(price) {
  const value = Number(price);
  return Number.isFinite(value) ? `${value.toLocaleString()}원` : "가격 정보 없음";
}

export default function ResultProductDetailModal({ item, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-product-detail-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-bold text-violet-600">RESULT ITEM</p>
            <h2 id="result-product-detail-title" className="mt-1 text-xl font-black text-slate-950">
              상품 상세정보
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label="상품 상세정보 닫기"
          >
            ×
          </button>
        </header>

        <div className="grid gap-7 p-6 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="aspect-[4/5] h-full w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center text-sm text-slate-400">
                상품 이미지가 없습니다
              </div>
            )}
          </div>

          <div className="min-w-0 self-center">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
                전체 {item.rank}위
              </span>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                {item.tier?.tierName ?? "티어 정보 없음"}
              </span>
            </div>
            <p className="mt-5 text-sm font-bold text-slate-500">{item.brand || "브랜드 정보 없음"}</p>
            <h3 className="mt-2 text-2xl font-black leading-tight text-slate-950">
              {item.name || `상품 #${item.productId}`}
            </h3>
            <p className="mt-4 text-xl font-black text-violet-700">{formatPrice(item.price)}</p>

            <dl className="mt-7 overflow-hidden rounded-2xl border border-slate-200 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                <dt className="font-semibold text-slate-400">티어 내 위치</dt>
                <dd className="font-bold text-slate-700">{Number(item.position).toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                <dt className="font-semibold text-slate-400">상품 ID</dt>
                <dd className="font-bold text-slate-700">{item.productId ?? "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="font-semibold text-slate-400">방 아이템 ID</dt>
                <dd className="font-bold text-slate-700">{item.roomItemId ?? "-"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
