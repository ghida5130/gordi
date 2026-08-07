import { useEffect } from 'react'
import { motion } from 'motion/react'

import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

function RoomFinishConfirmModal({ isFinishing, onConfirm, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isFinishing) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFinishing, onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isFinishing) onClose()
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-maker-room-finish-title"
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <TierMakerIcon name="door" size={22} />
        </span>

        <h2
          id="tier-maker-room-finish-title"
          className="mt-5 text-xl font-black text-slate-950"
        >
          티어메이커를 종료할까요?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          종료하면 모든 참여자의 티어메이킹이 끝나고 결과 페이지로
          이동합니다. 종료한 보드는 다시 편집할 수 없습니다.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isFinishing}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isFinishing}
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFinishing ? '종료 중...' : '종료하기'}
          </button>
        </div>
      </motion.section>
    </motion.div>
  )
}

export default RoomFinishConfirmModal
