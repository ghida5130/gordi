import { useState } from 'react'

import ClothingArtwork from '@/components/tierMaker/ClothingArtwork'
import ClothingDetailButton from '@/components/tierMaker/ClothingDetailButton'
import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

function Mannequin({ generatedItems }) {
  const upperItem =
    generatedItems.find((item) => item.category === 'outer') ??
    generatedItems.find((item) => item.category === 'top')
  const bottomItem = generatedItems.find(
    (item) => item.category === 'bottom',
  )
  const shoesItem = generatedItems.find((item) => item.category === 'shoes')

  return (
    <div className="relative mx-auto h-64 w-44">
      <div className="absolute left-1/2 top-3 size-12 -translate-x-1/2 rounded-full bg-[#e9ded2] shadow-inner" />
      <div className="absolute left-1/2 top-[58px] h-4 w-5 -translate-x-1/2 rounded bg-[#e9ded2]" />
      <div
        className="absolute left-1/2 top-[69px] h-[91px] w-[75px] -translate-x-1/2 rounded-[28px_28px_20px_20px] bg-[#e9ded2] shadow-sm"
        style={
          upperItem ? { backgroundColor: upperItem.fittingColor } : undefined
        }
      />
      <div className="absolute left-[35px] top-[76px] h-[99px] w-[18px] rotate-[8deg] rounded-full bg-[#e9ded2]" />
      <div className="absolute right-[35px] top-[76px] h-[99px] w-[18px] -rotate-[8deg] rounded-full bg-[#e9ded2]" />
      <div
        className="absolute bottom-[14px] left-[54px] h-[105px] w-[29px] rounded-[12px_12px_14px_14px] bg-[#ded1c4]"
        style={
          bottomItem ? { backgroundColor: bottomItem.fittingColor } : undefined
        }
      />
      <div
        className="absolute bottom-[14px] right-[54px] h-[105px] w-[29px] rounded-[12px_12px_14px_14px] bg-[#ded1c4]"
        style={
          bottomItem ? { backgroundColor: bottomItem.fittingColor } : undefined
        }
      />
      <div
        className="absolute bottom-1 left-[41px] h-4 w-11 rounded-full bg-slate-700"
        style={
          shoesItem ? { backgroundColor: shoesItem.fittingColor } : undefined
        }
      />
      <div
        className="absolute bottom-1 right-[41px] h-4 w-11 rounded-full bg-slate-700"
        style={
          shoesItem ? { backgroundColor: shoesItem.fittingColor } : undefined
        }
      />
      <div className="absolute left-1/2 top-[36px] flex -translate-x-1/2 gap-3">
        <span className="size-1 rounded-full bg-slate-600" />
        <span className="size-1 rounded-full bg-slate-600" />
      </div>
      <div className="absolute left-1/2 top-[46px] h-1.5 w-3 -translate-x-1/2 rounded-b-full border-b border-slate-500" />
    </div>
  )
}

function FittingPanel({
  candidates,
  hostAvatarImageUrl,
  selectedSizeNames = {},
  onSizeChange = () => {},
  onDropCandidate,
  onRemoveCandidate,
  onDragStart,
  onDragEnd,
  onGenerate,
  canGenerate,
  generateDisabledMessage,
  isSubmitting,
  tryOn,
  errorMessage,
  onViewDetails,
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const isProcessing =
    isSubmitting ||
    ['QUEUED', 'PROCESSING', 'PROGRESSING'].includes(tryOn.status)
  const hasUnavailableSizes = candidates.some(
    (item) => !Array.isArray(item.sizeNames) || item.sizeNames.length === 0,
  )
  const hasUnselectedSizes = candidates.some(
    (item) =>
      Array.isArray(item.sizeNames) &&
      item.sizeNames.length > 0 &&
      !item.sizeNames.includes(selectedSizeNames[item.id]),
  )
  const isSizeSelectionComplete =
    candidates.length > 0 &&
    !hasUnavailableSizes &&
    !hasUnselectedSizes

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDraggingOver(false)
    onDropCandidate(event.dataTransfer.getData('text/plain'))
  }

  const handleGenerate = () => {
    if (!isSizeSelectionComplete || isProcessing || !canGenerate) return

    onGenerate()
  }

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <TierMakerIcon name="sparkles" size={18} />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">AI 가상 피팅</h2>
            <p className="text-xs text-slate-500">나만의 착장을 미리 확인하세요</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setIsDraggingOver(true)
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={`relative overflow-hidden rounded-2xl border transition ${
            isDraggingOver
              ? 'border-violet-400 bg-violet-50 ring-4 ring-violet-100'
              : 'border-slate-200 bg-gradient-to-b from-[#f5f2ff] to-[#f8fafc]'
          }`}
        >
          <div className="absolute inset-x-8 bottom-3 h-8 rounded-[50%] bg-slate-300/25 blur-sm" />
          <div className="relative flex min-h-[292px] items-center justify-center pt-3">
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <span className="size-12 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
                <p className="mt-4 text-sm font-semibold text-violet-700">
                  착장을 만들고 있어요
                </p>
              </div>
            ) : tryOn.status === 'SUCCEEDED' &&
              tryOn.resultImageUrl ? (
              <img
                src={tryOn.resultImageUrl}
                alt="가상 피팅 결과"
                className="h-[292px] w-full object-cover"
              />
            ) : hostAvatarImageUrl ? (
              <img
                src={hostAvatarImageUrl}
                alt="방장 아바타"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <Mannequin generatedItems={candidates} />
            )}
          </div>
          {candidates.length === 0 && !isProcessing && (
            <p className="absolute inset-x-0 bottom-3 text-center text-[11px] text-slate-400">
              의상을 놓고 아바타를 생성해 보세요
            </p>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">피팅 후보</p>
            <span className="text-[11px] text-slate-400">
              카테고리별 1개
            </span>
          </div>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className={`mt-2 grid min-h-[92px] grid-cols-2 gap-2 rounded-xl border border-dashed p-2 ${
              isDraggingOver
                ? 'border-violet-300 bg-violet-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            {candidates.length > 0 ? (
              candidates.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => onDragStart(event, item.id)}
                  onDragEnd={(event) => onDragEnd(event, item.id)}
                  className="group relative cursor-grab"
                >
                  <div className="relative">
                    <ClothingArtwork
                      item={item}
                      className="aspect-square rounded-lg border border-slate-200"
                    />
                    <ClothingDetailButton
                      item={item}
                      onViewDetails={onViewDetails}
                      className="inset-x-1.5 bottom-1.5"
                    />
                  </div>
                  <label className="mt-1 block">
                    <span className="sr-only">{item.name} 사이즈 선택</span>
                    <select
                      value={
                        item.sizeNames?.includes(selectedSizeNames[item.id])
                          ? selectedSizeNames[item.id]
                          : ''
                      }
                      onChange={(event) =>
                        onSizeChange(item.id, event.target.value)
                      }
                      onPointerDown={(event) => event.stopPropagation()}
                      onDragStart={(event) => event.stopPropagation()}
                      draggable={false}
                      disabled={!item.sizeNames?.length}
                      className="h-7 w-full rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {item.sizeNames?.length
                          ? '사이즈 선택'
                          : '사이즈 정보 없음'}
                      </option>
                      {item.sizeNames?.map((sizeName) => (
                        <option key={sizeName} value={sizeName}>
                          {sizeName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemoveCandidate(item.id)}
                    className="absolute -right-1 -top-1 hidden size-5 items-center justify-center rounded-full bg-slate-800 text-white group-hover:flex"
                    aria-label={`${item.name} 피팅 후보에서 제거`}
                  >
                    <TierMakerIcon name="close" size={11} />
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-2 flex items-center justify-center text-[11px] text-slate-400">
                의상을 이곳으로 드래그하세요
              </div>
            )}
          </div>
          {candidates.length > 0 && hasUnavailableSizes ? (
            <p className="mt-2 text-[11px] leading-4 text-rose-600">
              사이즈 정보가 없는 의상은 가상 피팅에 사용할 수 없습니다.
            </p>
          ) : candidates.length > 0 && hasUnselectedSizes ? (
            <p className="mt-2 text-[11px] leading-4 text-violet-600">
              가상 피팅에 사용할 사이즈를 모두 선택해 주세요.
            </p>
          ) : null}
        </div>

        {(tryOn.status === 'FAILED' || errorMessage) && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage || tryOn.reason}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={
            !isSizeSelectionComplete || isProcessing || !canGenerate
          }
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          <TierMakerIcon name="sparkles" size={17} />
          {isProcessing
            ? '생성 중...'
            : !canGenerate
              ? generateDisabledMessage
              : candidates.length > 0 && !isSizeSelectionComplete
                ? '사이즈를 선택해 주세요'
                : '아바타 생성하기'}
        </button>
      </div>
    </aside>
  )
}

export default FittingPanel
