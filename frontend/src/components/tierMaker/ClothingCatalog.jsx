import { useMemo, useState } from 'react'

import ClothingArtwork from '@/components/tierMaker/ClothingArtwork'
import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

const categories = [
  ['all', '전체'],
  ['top', '상의'],
  ['outer', '아우터'],
  ['bottom', '하의'],
  ['shoes', '신발'],
]

function ClothingCatalog({ clothes, tierByItem, onDragStart, onUnrank }) {
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
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">의상 보관함</h2>
            <p className="mt-1 text-xs text-slate-500">
              총 {clothes.length}개의 아이템
            </p>
          </div>
          <button
            type="button"
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

      <div className="grid grid-cols-2 gap-3 overflow-y-auto p-4">
        {filteredClothes.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(event) => onDragStart(event, item.id)}
            className="group relative cursor-grab rounded-2xl border border-slate-200 bg-white p-2 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg active:cursor-grabbing"
          >
            <ClothingArtwork
              item={item}
              className="aspect-square w-full rounded-xl"
            />
            <div className="px-1 pb-1 pt-2">
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-xs font-bold text-slate-800">
                  {item.name}
                </p>
                {tierByItem[item.id] && (
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
          </div>
        ))}

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
