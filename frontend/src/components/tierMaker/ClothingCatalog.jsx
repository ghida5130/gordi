import { useMemo, useState } from 'react'

import ClothingArtwork from '@/components/tierMaker/ClothingArtwork'
import ClothingDetailButton from '@/components/tierMaker/ClothingDetailButton'
import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

const categories = [
  ['all', '전체'],
  ['top', '상의'],
  ['outer', '아우터'],
  ['bottom', '하의'],
  ['shoes', '신발'],
]

function ClothingCatalog({
  clothes,
  tierByItem = {},
  itemLocks,
  currentParticipantId,
  onDragStart,
  onDragEnd,
  onUnrank,
  onDeleteItem,
  onAddClothing,
  onViewDetails,
  title = '피팅 전용 보관함',
  description = `티어 배정 불가 · 총 ${clothes.length}개`,
}) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [keyword, setKeyword] = useState('')

  const filteredClothes = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return clothes.filter(
      (item) =>
        (activeCategory === 'all' || item.category === activeCategory) &&
        item.name.toLowerCase().includes(normalizedKeyword),
    )
  }, [activeCategory, clothes, keyword])

  return (
    <aside className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onAddClothing}
            disabled={!onAddClothing}
            className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="의상 추가"
          >
            <TierMakerIcon name="add" size={19} />
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-violet-300 focus-within:bg-white">
          <TierMakerIcon name="search" size={17} className="text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="의상 검색"
          />
        </label>

        <div className="mt-3 flex gap-1 overflow-x-auto">
          {categories.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveCategory(value)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                activeCategory === value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {filteredClothes.map((item) => {
          const lock = itemLocks[item.id]
          const isLockedByOther =
            lock &&
            String(lock.ownerParticipantId) !==
              String(currentParticipantId)

          return (
            <div
              key={item.id}
              draggable={!isLockedByOther}
              onDragStart={(event) => onDragStart(event, item.id)}
              onDragEnd={(event) => onDragEnd(event, item.id)}
              className={`group relative overflow-hidden rounded-2xl border bg-white transition ${
                isLockedByOther
                  ? 'cursor-not-allowed border-amber-300 opacity-60'
                  : 'origin-center transform-gpu cursor-grab border-slate-200 hover:-translate-y-1 hover:-rotate-1 hover:border-violet-300 hover:shadow-lg active:cursor-grabbing'
              }`}
            >
            {onDeleteItem && !lock && (
              <button
                type="button"
                draggable={false}
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteItem(item)
                }}
                className="absolute right-2 top-2 z-20 hidden size-6 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-md transition hover:bg-red-50 hover:text-red-600 group-hover:flex"
                aria-label={`${item.name} 삭제`}
              >
                <TierMakerIcon name="close" size={12} />
              </button>
            )}
            <ClothingArtwork
              item={item}
              className="aspect-square w-full"
            />
            <div className="px-3 pb-3 pt-2">
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-xs font-bold text-slate-800">
                  {item.name}
                </p>
                {tierByItem[item.id] && onUnrank && (
                  <button
                    type="button"
                    onClick={() => onUnrank(item.id)}
                    className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    aria-label={`${item.name} 티어 배정 취소`}
                  >
                    <TierMakerIcon name="close" size={12} />
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {item.categoryLabel}
                </span>
                {tierByItem[item.id] ? (
                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-black text-violet-600">
                    {tierByItem[item.id]} TIER
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">미배정</span>
                )}
              </div>
            </div>
            <ClothingDetailButton
              item={item}
              onViewDetails={onViewDetails}
              className="inset-x-2 bottom-[58px]"
            />
            {lock && (
              <span className="absolute inset-x-2 top-2 truncate rounded-lg bg-slate-900/85 px-2 py-1 text-center text-[9px] font-bold text-white">
                {isLockedByOther
                  ? `${lock.ownerNickname ?? '다른 참여자'} 이동 중`
                  : '내가 이동 중'}
              </span>
            )}
            </div>
          )
        })}

        {filteredClothes.length === 0 && (
          <div className="col-span-2 py-12 text-center text-sm text-slate-400">
            검색 결과가 없습니다
          </div>
        )}
      </div>
    </aside>
  )
}

export default ClothingCatalog
