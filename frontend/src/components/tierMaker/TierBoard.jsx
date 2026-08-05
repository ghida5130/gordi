import { Fragment, useState } from 'react'

import ClothingArtwork from '@/components/tierMaker/ClothingArtwork'
import ClothingDetailButton from '@/components/tierMaker/ClothingDetailButton'
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
  onUnrank,
  onViewDetails,
}) {
  const isLockedByOther =
    lock &&
    String(lock.ownerParticipantId) !== String(currentParticipantId)

  return (
    <div
      draggable={!isLockedByOther}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={(event) => onDragEnd(event, item.id)}
      className={`group relative h-[92px] w-[84px] shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        isLockedByOther
          ? 'cursor-not-allowed border-amber-300 opacity-60'
          : 'cursor-grab border-slate-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md active:cursor-grabbing'
      }`}
    >
      <ClothingArtwork item={item} className="h-full w-full" />
      {onUnrank && !isLockedByOther && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onUnrank(item.id)
          }}
          className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm hover:bg-red-50 hover:text-red-500 group-hover:flex"
          aria-label={`${item.name} 티어 배정 취소`}
        >
          <TierMakerIcon name="close" size={11} />
        </button>
      )}
      <ClothingDetailButton
        item={item}
        onViewDetails={onViewDetails}
        className={lock ? 'inset-x-2 bottom-7' : 'inset-x-2 bottom-2'}
      />
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

function TierDropZone({ isActive, isTierActive, onActivate, onDrop }) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onActivate()
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDrop(event.dataTransfer.getData('text/plain'))
      }}
      className={`flex h-[92px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition-all ${
        isActive
          ? 'w-16 border-violet-400 bg-violet-100 text-violet-600'
          : isTierActive
            ? 'w-6 border-violet-200 bg-white text-transparent'
            : 'w-3 border-transparent bg-transparent text-transparent'
      }`}
    >
      <span className="text-[9px] font-black [writing-mode:vertical-rl]">
        여기에 놓기
      </span>
    </div>
  )
}

function WaitingItem({
  item,
  lock,
  currentParticipantId,
  onDragStart,
  onDragEnd,
  onViewDetails,
}) {
  return (
    <div className="w-[84px] shrink-0">
      <TierItem
        item={item}
        lock={lock}
        currentParticipantId={currentParticipantId}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onViewDetails={onViewDetails}
      />
      <p className="mt-1 truncate text-center text-[10px] font-semibold text-slate-600">
        {item.name}
      </p>
    </div>
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
  waitingClothes = [],
  roomCategory,
  onUnrank,
  onViewDetails,
}) {
  const [activeTier, setActiveTier] = useState(null)
  const [activeDropTarget, setActiveDropTarget] = useState(null)
  const [isWaitingActive, setIsWaitingActive] = useState(false)

  const dropItem = (itemId, tierId, newIndex) => {
    setActiveTier(null)
    setActiveDropTarget(null)
    onDropTier(itemId, tierId, newIndex)
  }

  const handleDrop = (event, tierId, newIndex) => {
    event.preventDefault()
    dropItem(event.dataTransfer.getData('text/plain'), tierId, newIndex)
  }

  const handleWaitingDrop = (event) => {
    event.preventDefault()
    setIsWaitingActive(false)
    onUnrank?.(event.dataTransfer.getData('text/plain'))
  }

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
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

      <div className="p-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {tiers.map((tier, tierIndex) => (
            <div
              key={tier.id}
              onDragOver={(event) => {
                event.preventDefault()
                setActiveTier(tier.id)
                setActiveDropTarget(null)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setActiveTier(null)
                }
              }}
              onDrop={(event) => handleDrop(event, tier.id)}
              className={`flex min-h-[112px] border-b border-slate-200 last:border-b-0 ${
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
              <div className="flex min-w-0 flex-1 flex-wrap content-center items-center gap-0 p-2">
                {tier.itemIds.length > 0 ? (
                  <>
                    {tier.itemIds.map((itemId, itemIndex) => {
                      const dropTarget = `${tier.id}:${itemIndex}`

                      return (
                        <Fragment key={itemId}>
                          <TierDropZone
                            isActive={activeDropTarget === dropTarget}
                            isTierActive={activeTier === tier.id}
                            onActivate={() => {
                              setActiveTier(tier.id)
                              setActiveDropTarget(dropTarget)
                            }}
                            onDrop={(draggedItemId) =>
                              dropItem(draggedItemId, tier.id, itemIndex)
                            }
                          />
                          <TierItem
                            item={clothesById[itemId]}
                            lock={itemLocks[itemId]}
                            currentParticipantId={currentParticipantId}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onUnrank={onUnrank}
                            onViewDetails={onViewDetails}
                          />
                        </Fragment>
                      )
                    })}
                    <TierDropZone
                      isActive={
                        activeDropTarget ===
                        `${tier.id}:${tier.itemIds.length}`
                      }
                      isTierActive={activeTier === tier.id}
                      onActivate={() => {
                        setActiveTier(tier.id)
                        setActiveDropTarget(
                          `${tier.id}:${tier.itemIds.length}`,
                        )
                      }}
                      onDrop={(draggedItemId) =>
                        dropItem(
                          draggedItemId,
                          tier.id,
                          tier.itemIds.length,
                        )
                      }
                    />
                  </>
                ) : (
                  <div
                    className={`flex h-[92px] min-w-44 flex-1 items-center justify-center rounded-xl border border-dashed text-xs ${
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

        {(onUnrank || roomCategory || waitingClothes.length > 0) && (
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsWaitingActive(true)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setIsWaitingActive(false)
              }
            }}
            onDrop={handleWaitingDrop}
            className={`mt-3 rounded-2xl border p-3 transition ${
              isWaitingActive
                ? 'border-violet-400 bg-violet-50 ring-4 ring-violet-100'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  티어 배정 대기
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {roomCategory || '방 카테고리'} 의상만 배정 가능
                </p>
              </div>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-600">
                {waitingClothes.length}개
              </span>
            </div>
            <div className="mt-2 flex min-h-[116px] flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2">
              {waitingClothes.length > 0 ? (
                waitingClothes.map((item) => (
                  <WaitingItem
                    key={item.id}
                    item={item}
                    lock={itemLocks[item.id]}
                    currentParticipantId={currentParticipantId}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onViewDetails={onViewDetails}
                  />
                ))
              ) : (
                <p className="w-full text-center text-xs text-slate-400">
                  티어 배정을 기다리는 의상이 없습니다.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default TierBoard
