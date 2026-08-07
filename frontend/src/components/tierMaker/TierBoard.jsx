import { useEffect, useState } from "react";
import { motion } from "motion/react";

import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";
import ClothingDetailButton from "@/components/tierMaker/ClothingDetailButton";
import TierMakerIcon from "@/components/tierMaker/TierMakerIcon";

const tierStyles = [
  "bg-[#f2b8b5] text-[#743b39]",
  "bg-[#f5cca4] text-[#744c2e]",
  "bg-[#f4e3a8] text-[#655927]",
  "bg-[#cde3c8] text-[#3f6143]",
  "bg-[#dbe1e8] text-[#46515e]",
];

function TierItem({
  item,
  lock,
  currentParticipantId,
  onDragStart,
  onDragEnd,
  onDeleteItem,
  onViewDetails,
  cursorAnchor,
  isExpanded = false,
}) {
  const isLockedByOther =
    lock && String(lock.ownerParticipantId) !== String(currentParticipantId);

  return (
    <div
      data-tier-maker-cursor-anchor={cursorAnchor}
      draggable={!isLockedByOther}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={(event) => onDragEnd(event, item.id)}
      className={`group relative shrink-0 overflow-hidden border bg-white shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isExpanded
          ? "h-[190px] w-[182px] rounded-2xl"
          : "h-[110px] w-[100px] rounded-xl"
      } ${
        isLockedByOther
          ? "cursor-not-allowed border-amber-300 opacity-60"
          : "origin-center transform-gpu cursor-grab border-slate-200 hover:-translate-y-1 hover:-rotate-1 hover:border-violet-300 hover:shadow-md active:cursor-grabbing"
      }`}
    >
      <ClothingArtwork item={item} className="h-full w-full" />
      {onDeleteItem && !isLockedByOther && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteItem(item);
          }}
          className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm hover:bg-red-50 hover:text-red-500 group-hover:flex"
          aria-label={`${item.name} 삭제`}
        >
          <TierMakerIcon name="close" size={11} />
        </button>
      )}
      <ClothingDetailButton
        item={item}
        onViewDetails={onViewDetails}
        className={lock ? "inset-x-2 bottom-7" : "inset-x-2 bottom-2"}
      />
      {lock && (
        <span className="absolute inset-x-1 bottom-1 truncate rounded bg-slate-900/85 px-1 py-0.5 text-center text-[9px] font-bold text-white">
          {isLockedByOther
            ? `${lock.ownerNickname ?? "다른 참여자"} 이동 중`
            : "내가 이동 중"}
        </span>
      )}
    </div>
  );
}

function TierName({ tier, canRename, onRename }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(tier.name);

  const commitName = () => {
    const nextName = name.trim().slice(0, 10);
    setIsEditing(false);

    if (!nextName) {
      setName(tier.name);
      return;
    }

    if (nextName !== tier.name) {
      onRename(tier.id, nextName);
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            setName(tier.name);
            setIsEditing(false);
          }
        }}
        maxLength={10}
        className="w-[92px] rounded-lg border border-white/70 bg-white/90 px-2 py-1.5 text-center text-sm font-black text-slate-900 outline-none"
        aria-label={`${tier.name} 티어 이름 변경`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!canRename) return;

        setName(tier.name);
        setIsEditing(true);
      }}
      disabled={!canRename}
      className="w-full whitespace-normal break-all px-2 text-center text-base leading-5 disabled:cursor-default"
      title={canRename ? "클릭하여 티어 이름 변경" : tier.name}
    >
      {tier.name}
    </button>
  );
}

function TierDropZone({
  isExpanded,
  cursorAnchor,
  placement = "before",
  onActivate,
  onDrop,
}) {
  return (
    <div
      data-tier-maker-cursor-anchor={cursorAnchor}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onActivate();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop(event.dataTransfer.getData("text/plain"));
      }}
      aria-hidden="true"
      className={`tier-maker-insert-zone pointer-events-none absolute top-1/2 z-20 w-8 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-transparent bg-transparent opacity-0 ${
        isExpanded ? "h-[190px]" : "h-[110px]"
      }`}
      style={{
        left: placement === "after" ? "100%" : "0%",
      }}
    />
  );
}

function TierDropPlaceholder({
  tierId,
  dropIndex,
  isExpanded,
  onActivate,
  onDrop,
}) {
  return (
    <motion.div
      layout="position"
      data-tier-maker-cursor-anchor={`tier-drop:${tierId}:${dropIndex}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        layout: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.15 },
        scale: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onActivate();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop(event.dataTransfer.getData("text/plain"));
      }}
      className={`relative z-20 mx-auto flex items-center justify-center rounded-2xl border-2 border-dashed border-violet-400 bg-violet-100/90 px-2 text-center text-[11px] font-black text-violet-600 shadow-sm ${
        isExpanded ? "h-[190px] w-[182px]" : "h-[110px] w-[100px]"
      }`}
    >
      <span aria-hidden="true" className="absolute -inset-x-4 inset-y-0" />
      <span className="relative">여기에 놓기</span>
    </motion.div>
  );
}

function WaitingItem({
  item,
  lock,
  currentParticipantId,
  onDragStart,
  onDragEnd,
  onDeleteItem,
  onViewDetails,
  cursorAnchor,
  isExpanded,
}) {
  return (
    <div
      data-tier-maker-cursor-anchor={`${cursorAnchor}:container`}
      className={`mx-auto shrink-0 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isExpanded ? "w-[182px]" : "w-[100px]"
      }`}
    >
      <TierItem
        item={item}
        lock={lock}
        currentParticipantId={currentParticipantId}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDeleteItem={onDeleteItem}
        onViewDetails={onViewDetails}
        cursorAnchor={cursorAnchor}
        isExpanded={isExpanded}
      />
      <p
        className={`mt-1 truncate text-center font-semibold text-slate-600 ${
          isExpanded ? "text-xs" : "text-[10px]"
        }`}
      >
        {item.name}
      </p>
    </div>
  );
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
  onDeleteItem,
  onViewDetails,
  isExpanded = false,
}) {
  const [activeTier, setActiveTier] = useState(null);
  const [activeDropTarget, setActiveDropTarget] = useState(null);
  const [isWaitingActive, setIsWaitingActive] = useState(false);

  const dropItem = (itemId, tierId, newIndex) => {
    setActiveTier(null);
    setActiveDropTarget(null);
    onDropTier(itemId, tierId, newIndex);
  };

  const handleDrop = (event, tierId, newIndex) => {
    event.preventDefault();
    dropItem(event.dataTransfer.getData("text/plain"), tierId, newIndex);
  };

  const handleWaitingDrop = (event) => {
    event.preventDefault();
    setActiveTier(null);
    setActiveDropTarget(null);
    setIsWaitingActive(false);
    onUnrank?.(event.dataTransfer.getData("text/plain"));
  };

  useEffect(() => {
    const clearDropPreview = () => {
      setActiveTier(null);
      setActiveDropTarget(null);
      setIsWaitingActive(false);
    };

    window.addEventListener("dragend", clearDropPreview);
    window.addEventListener("drop", clearDropPreview);

    return () => {
      window.removeEventListener("dragend", clearDropPreview);
      window.removeEventListener("drop", clearDropPreview);
    };
  }, []);

  return (
    <section
      data-tier-maker-cursor-anchor="tier-board"
      className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
    >
      <div
        data-tier-maker-cursor-anchor="tier-header"
        className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900">티어메이커</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            의상을 원하는 등급으로 드래그하세요
          </p>
        </div>
      </div>

      <div data-tier-maker-cursor-anchor="tier-content" className="px-4">
        <div
          data-tier-maker-cursor-anchor="tier-content-top-gap"
          className="h-4"
        />
        <div
          data-tier-maker-cursor-anchor="tier-list"
          className="overflow-hidden rounded-2xl border border-slate-200"
        >
          {tiers.map((tier, tierIndex) => (
            <div
              key={tier.id}
              data-tier-maker-cursor-anchor={`tier-row:${tier.id}`}
              onDragOver={(event) => {
                event.preventDefault();
                setActiveTier(tier.id);
                setActiveDropTarget(null);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setActiveTier(null);
                  setActiveDropTarget(null);
                }
              }}
              onDrop={(event) => handleDrop(event, tier.id)}
              className={`flex border-b border-slate-200 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] last:border-b-0 ${
                isExpanded ? "min-h-[198px]" : "min-h-[118px]"
              } ${
                activeTier === tier.id ? "bg-violet-50/80" : "bg-slate-50/70"
              }`}
            >
              <div
                data-tier-maker-cursor-anchor={`tier-label:${tier.id}`}
                className={`flex shrink-0 items-center justify-center px-2 font-black transition-[width,font-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isExpanded ? "w-[140px] text-xl" : "w-[112px] text-lg"
                } ${tierStyles[tierIndex % tierStyles.length]}`}
              >
                <TierName
                  tier={tier}
                  canRename={canRename}
                  onRename={onRenameTier}
                />
              </div>
              <div
                data-tier-maker-cursor-anchor={`tier-items:${tier.id}`}
                className={`grid min-w-0 flex-1 content-center items-center gap-y-1.5 transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isExpanded ? "px-2.5 py-1" : "px-2 py-1"
                }`}
                style={{
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                }}
              >
                {tier.itemIds.length > 0 ? (
                  tier.itemIds.flatMap((itemId, itemIndex) => {
                    const dropTarget = `${tier.id}:${itemIndex}`;
                    const isLastItem = itemIndex === tier.itemIds.length - 1;
                    const finalDropTarget = `${tier.id}:${tier.itemIds.length}`;
                    const gridItems = [];
                    const getSlotDropIndex = (event) => {
                      const bounds =
                        event.currentTarget.getBoundingClientRect();

                      return event.clientX < bounds.left + bounds.width / 2
                        ? itemIndex
                        : itemIndex + 1;
                    };

                    if (activeDropTarget === dropTarget) {
                      gridItems.push(
                        <TierDropPlaceholder
                          key={`placeholder:${dropTarget}`}
                          tierId={tier.id}
                          dropIndex={itemIndex}
                          isExpanded={isExpanded}
                          onActivate={() => {
                            setActiveTier(tier.id);
                            setActiveDropTarget(dropTarget);
                          }}
                          onDrop={(draggedItemId) =>
                            dropItem(draggedItemId, tier.id, itemIndex)
                          }
                        />,
                      );
                    }

                    gridItems.push(
                      <motion.div
                        layout="position"
                        key={`item:${itemId}`}
                        data-tier-maker-cursor-anchor={`tier-slot:${tier.id}:${itemId}`}
                        transition={{
                          layout: {
                            duration: 0.24,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          const nextDropIndex = getSlotDropIndex(event);
                          setActiveTier(tier.id);
                          setActiveDropTarget(`${tier.id}:${nextDropIndex}`);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          dropItem(
                            event.dataTransfer.getData("text/plain"),
                            tier.id,
                            getSlotDropIndex(event),
                          );
                        }}
                        className="relative flex min-w-0 justify-center"
                      >
                        {activeDropTarget !== dropTarget && (
                          <TierDropZone
                            isExpanded={isExpanded}
                            cursorAnchor={`tier-drop:${tier.id}:${itemIndex}`}
                            onActivate={() => {
                              setActiveTier(tier.id);
                              setActiveDropTarget(dropTarget);
                            }}
                            onDrop={(draggedItemId) =>
                              dropItem(draggedItemId, tier.id, itemIndex)
                            }
                          />
                        )}
                        <TierItem
                          item={clothesById[itemId]}
                          lock={itemLocks[itemId]}
                          currentParticipantId={currentParticipantId}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          onDeleteItem={onDeleteItem}
                          onViewDetails={onViewDetails}
                          isExpanded={isExpanded}
                        />
                        {isLastItem && activeDropTarget !== finalDropTarget && (
                          <TierDropZone
                            isExpanded={isExpanded}
                            cursorAnchor={`tier-drop:${tier.id}:${tier.itemIds.length}`}
                            placement="after"
                            onActivate={() => {
                              setActiveTier(tier.id);
                              setActiveDropTarget(finalDropTarget);
                            }}
                            onDrop={(draggedItemId) =>
                              dropItem(
                                draggedItemId,
                                tier.id,
                                tier.itemIds.length,
                              )
                            }
                          />
                        )}
                      </motion.div>,
                    );

                    if (isLastItem && activeDropTarget === finalDropTarget) {
                      gridItems.push(
                        <TierDropPlaceholder
                          key={`placeholder:${finalDropTarget}`}
                          tierId={tier.id}
                          dropIndex={tier.itemIds.length}
                          isExpanded={isExpanded}
                          onActivate={() => {
                            setActiveTier(tier.id);
                            setActiveDropTarget(finalDropTarget);
                          }}
                          onDrop={(draggedItemId) =>
                            dropItem(
                              draggedItemId,
                              tier.id,
                              tier.itemIds.length,
                            )
                          }
                        />,
                      );
                    }

                    return gridItems;
                  })
                ) : (
                  <div
                    data-tier-maker-cursor-anchor={`tier-empty:${tier.id}`}
                    className={`col-span-full flex min-w-44 w-full items-center justify-center rounded-xl border border-dashed text-xs transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isExpanded ? "h-[190px]" : "h-[110px]"
                    } ${
                      activeTier === tier.id
                        ? "border-violet-300 bg-white text-violet-500"
                        : "border-slate-200 text-slate-400"
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
          <>
            <div
              data-tier-maker-cursor-anchor="tier-waiting-gap"
              className="h-3"
            />
            <div
              data-tier-maker-cursor-anchor="waiting"
              onDragOver={(event) => {
                event.preventDefault();
                setActiveTier(null);
                setActiveDropTarget(null);
                setIsWaitingActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsWaitingActive(false);
                }
              }}
              onDrop={handleWaitingDrop}
              className={`rounded-2xl border p-3 transition ${
                isWaitingActive
                  ? "border-violet-400 bg-violet-50 ring-4 ring-violet-100"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div
                data-tier-maker-cursor-anchor="waiting-header"
                className="flex items-center justify-between gap-3"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    티어 배정 대기
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {roomCategory || "방 카테고리"} 의상만 배정 가능
                  </p>
                </div>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-600">
                  {waitingClothes.length}개
                </span>
              </div>
              <div
                data-tier-maker-cursor-anchor="waiting-items"
                className={`mt-2 grid content-start items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isExpanded ? "min-h-[158px] gap-3" : "min-h-[116px] gap-2"
                }`}
                style={{
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                }}
              >
                {waitingClothes.length > 0 ? (
                  waitingClothes.map((item) => (
                    <WaitingItem
                      key={item.id}
                      item={item}
                      lock={itemLocks[item.id]}
                      currentParticipantId={currentParticipantId}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDeleteItem={onDeleteItem}
                      onViewDetails={onViewDetails}
                      cursorAnchor={`waiting-item:${item.id}`}
                      isExpanded={isExpanded}
                    />
                  ))
                ) : (
                  <p className="col-span-full flex min-h-[98px] w-full items-center justify-center whitespace-nowrap text-center text-xs text-slate-400">
                    티어 배정을 기다리는 의상이 없습니다.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
        <div
          data-tier-maker-cursor-anchor="tier-content-bottom-gap"
          className="h-4"
        />
      </div>
    </section>
  );
}

export default TierBoard;
