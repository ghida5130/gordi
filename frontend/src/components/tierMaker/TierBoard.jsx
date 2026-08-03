import { useState } from 'react'

import ClothingArtwork from '@/components/tierMaker/ClothingArtwork'
import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

const tierStyles = [
  'bg-[#ff6b6b] text-white',
  'bg-[#ffad5b] text-white',
  'bg-[#ffd76b] text-slate-800',
  'bg-[#9fda8b] text-slate-800',
  'bg-slate-300 text-slate-700',
]

function TierItem({
  item,
  lock,
  currentParticipantId,
  onDragStart,
  onDragEnd,
  onDropItem,
}) {
  const isLockedByOther =
    lock &&
    String(lock.ownerParticipantId) !== String(currentParticipantId)

  return (
    <div
      draggable={!isLockedByOther}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={(event) => onDragEnd(event, item.id)}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDropItem(event.dataTransfer.getData('text/plain'))
      }}
      className={`group relative h-[74px] w-[68px] shrink-0 rounded-xl border bg-white p-1.5 shadow-sm transition ${
        isLockedByOther
          ? 'cursor-not-allowed border-amber-300 opacity-60'
          : 'cursor-grab border-slate-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md active:cursor-grabbing'
      }`}
      title={item.name}
    >
      <ClothingArtwork item={item} className="h-full w-full rounded-lg" />
      <span className="absolute right-1 top-1 rounded bg-white/85 p-0.5 text-slate-400 opacity-0 shadow-sm transition group-hover:opacity-100">
        <TierMakerIcon name="grip" size={13} />
      </span>
      {lock && (
        <span className="absolute inset-x-1 bottom-1 truncate rounded bg-slate-900/85 px-1 py-0.5 text-center text-[9px] font-bold text-white">
          {isLockedByOther
            ? `${lock.ownerNickname ?? '다른 참여자'} 이동 중`
            : '내가 이동 중'}
        </span>
      )}
    </div>
  )
}

function TierName({ tier, canRename, onRename }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(tier.name)

  const commitName = () => {
    const nextName = name.trim()
    setIsEditing(false)

    if (!nextName) {
      setName(tier.name)
      return
    }

    if (nextName !== tier.name) {
      onRename(tier.id, nextName)
    }
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }

          if (event.key === 'Escape') {
            setName(tier.name)
            setIsEditing(false)
          }
        }}
        maxLength={20}
        className="w-14 rounded-lg border border-white/60 bg-white/90 px-1 py-1 text-center text-base font-black text-slate-900 outline-none"
        aria-label={`${tier.name} 티어 이름 변경`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!canRename) return

        setName(tier.name)
        setIsEditing(true)
      }}
      disabled={!canRename}
      className="max-w-[64px] truncate px-1 text-center disabled:cursor-default"
      title={canRename ? '클릭하여 티어 이름 변경' : tier.name}
    >
      {tier.name}
    </button>
  )
}

function TierBoard({
  tiers,
  clothesById,
  onDropTier,
  onDragStart,
  onDragEnd,
  itemLocks,
  currentParticipantId,
  canRename = false,
  onRenameTier,
}) {
  const [activeTier, setActiveTier] = useState(null)

  const handleDrop = (event, tierId, newIndex) => {
    event.preventDefault()
    setActiveTier(null)
    onDropTier(
      event.dataTransfer.getData('text/plain'),
      tierId,
      newIndex,
    )
  }

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
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
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <TierMakerIcon name="users" size={15} />
          모두에게 실시간 공유
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {tiers.map((tier, tierIndex) => (
            <div
              key={tier.id}
              onDragOver={(event) => {
                event.preventDefault()
                setActiveTier(tier.id)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setActiveTier(null)
                }
              }}
              onDrop={(event) => handleDrop(event, tier.id)}
              className={`flex min-h-[104px] border-b border-slate-200 last:border-b-0 ${
                activeTier === tier.id
                  ? 'bg-violet-50/80'
                  : 'bg-slate-50/70'
              }`}
            >
              <div
                className={`flex w-[78px] shrink-0 items-center justify-center text-3xl font-black ${
                  tierStyles[tierIndex % tierStyles.length]
                }`}
              >
                <TierName
                  tier={tier}
                  canRename={canRename}
                  onRename={onRenameTier}
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-3">
                {tier.itemIds.length > 0 ? (
                  tier.itemIds.map((itemId, itemIndex) => (
                    <TierItem
                      key={itemId}
                      item={clothesById[itemId]}
                      lock={itemLocks[itemId]}
                      currentParticipantId={currentParticipantId}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDropItem={(draggedItemId) =>
                        onDropTier(
                          draggedItemId,
                          tier.id,
                          itemIndex,
                        )
                      }
                    />
                  ))
                ) : (
                  <div
                    className={`flex h-[74px] min-w-44 flex-1 items-center justify-center rounded-xl border border-dashed text-xs ${
                      activeTier === tier.id
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
