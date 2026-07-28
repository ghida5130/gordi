import { useState } from 'react'

import ClothingArtwork from '@/components/tierMaker/ClothingArtwork'
import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

const tierStyles = {
  S: 'bg-[#ff6b6b] text-white',
  A: 'bg-[#ffad5b] text-white',
  B: 'bg-[#ffd76b] text-slate-800',
  C: 'bg-[#9fda8b] text-slate-800',
}

function TierItem({ item, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, item.id)}
      className="group relative h-[74px] w-[68px] shrink-0 cursor-grab rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md active:cursor-grabbing"
      title={item.name}
    >
      <ClothingArtwork item={item} className="h-full w-full rounded-lg" />
      <span className="absolute right-1 top-1 rounded bg-white/85 p-0.5 text-slate-400 opacity-0 shadow-sm transition group-hover:opacity-100">
        <TierMakerIcon name="grip" size={13} />
      </span>
    </div>
  )
}

function TierBoard({ tiers, clothesById, onDropTier, onDragStart }) {
  const [activeTier, setActiveTier] = useState(null)

  const handleDrop = (event, tier) => {
    event.preventDefault()
    setActiveTier(null)
    onDropTier(event.dataTransfer.getData('text/plain'), tier)
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900">오늘의 티어</h2>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-600">
              LIVE
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            의상을 원하는 등급으로 드래그하세요
          </p>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
          <TierMakerIcon name="users" size={15} />
          모두에게 실시간 공유
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {Object.entries(tiers).map(([tier, itemIds]) => (
            <div
              key={tier}
              onDragOver={(event) => {
                event.preventDefault()
                setActiveTier(tier)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setActiveTier(null)
                }
              }}
              onDrop={(event) => handleDrop(event, tier)}
              className={`flex min-h-[104px] border-b border-slate-200 last:border-b-0 ${
                activeTier === tier ? 'bg-violet-50/80' : 'bg-slate-50/70'
              }`}
            >
              <div
                className={`flex w-[68px] shrink-0 items-center justify-center text-3xl font-black sm:w-[78px] ${tierStyles[tier]}`}
              >
                {tier}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-3">
                {itemIds.length > 0 ? (
                  itemIds.map((itemId) => (
                    <TierItem
                      key={itemId}
                      item={clothesById[itemId]}
                      onDragStart={onDragStart}
                    />
                  ))
                ) : (
                  <div
                    className={`flex h-[74px] min-w-44 flex-1 items-center justify-center rounded-xl border border-dashed text-xs ${
                      activeTier === tier
                        ? 'border-violet-300 bg-white text-violet-500'
                        : 'border-slate-200 text-slate-400'
                    }`}
                  >
                    여기에 의상을 놓아주세요
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TierBoard
