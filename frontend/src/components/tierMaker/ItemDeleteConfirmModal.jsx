import { useEffect } from 'react'
import { motion } from 'motion/react'

import ClothingArtwork from '@/components/tierMaker/ClothingArtwork'

function ItemDeleteConfirmModal({
  item,
  isDeleting,
  errorMessage,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isDeleting) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onClose()
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-maker-item-delete-title"
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center gap-4">
          <ClothingArtwork
            item={item}
            className="size-16 shrink-0 rounded-2xl border border-slate-200"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">
              {item.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              티어메이커 방에서 완전히 제거됩니다.
            </p>
          </div>
        </div>

        <h2
          id="tier-maker-item-delete-title"
          className="mt-6 text-xl font-black text-slate-950"
        >
          이 항목을 삭제하시겠습니까?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          모든 참여자의 화면에서 해당 항목이 삭제됩니다.
        </p>

        {errorMessage && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? '삭제 중...' : '삭제하기'}
          </button>
        </div>
      </motion.section>
    </motion.div>
  )
}

export default ItemDeleteConfirmModal
