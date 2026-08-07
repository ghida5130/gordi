import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

import TierMakerIcon from "@/components/tierMaker/TierMakerIcon";

export default function FittingImagePreviewModal({
  isOpen,
  imageUrl,
  imageAlt,
  onClose,
}) {
  const isVisible = Boolean(isOpen && imageUrl);

  useEffect(() => {
    if (!isVisible) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, onClose]);

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${imageAlt} 크게 보기`}
        >
          <motion.section
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative flex h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] items-center justify-center sm:h-[calc(100dvh-4rem)] sm:w-[calc(100vw-3rem)]"
          >
            <img
              src={imageUrl}
              alt={imageAlt}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full border border-white/20 bg-slate-950/75 text-white shadow-lg backdrop-blur transition hover:bg-slate-950 sm:right-3 sm:top-3"
              aria-label="크게 보기 닫기"
            >
              <TierMakerIcon name="close" size={21} />
            </button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
