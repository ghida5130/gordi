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
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[6px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-product-detail-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(2,6,23,0.34)]"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-7 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
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
                <path d="M6 2h9l5 5v15H6z" />
                <path d="M14 2v6h6M9 13h6M9 17h6" />
              </svg>
            </span>
            <div>
              <h2 id="result-product-detail-title" className="text-xl font-black text-slate-950">
                상품 상세정보
              </h2>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ rotate: 6, scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500 transition-colors hover:bg-slate-950 hover:text-white"
            aria-label="상품 상세정보 닫기"
          >
            ×
          </motion.button>
        </header>

        <div className="grid gap-8 p-7 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-100 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            {item.imageUrl ? (
              <motion.img
                initial={{ opacity: 0, scale: 1.025 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08, duration: 0.36 }}
                src={item.imageUrl}
                alt={item.name}
                className="aspect-[4/5] h-full w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center text-sm text-slate-400">
                상품 이미지가 없습니다
              </div>
            )}
          </div>

          <div className="min-w-0 self-center">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                전체 {item.rank}위
              </span>
              <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                {item.tier?.tierName ?? "티어 정보 없음"}
              </span>
            </div>
            <p className="mt-6 text-xs font-bold tracking-[0.08em] text-slate-500">{item.brand || "브랜드 정보 없음"}</p>
            <h3 className="mt-2 text-2xl font-black leading-tight text-slate-950">
              {item.name || "상품명 정보 없음"}
            </h3>
            <p className="mt-4 text-xl font-black text-violet-700">{formatPrice(item.price)}</p>
            {item.purchaseUrl && (
              <a
                href={item.purchaseUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
              >
                상품 구매하러 가기
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
