import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ClothingArtwork from "@/components/tierMaker/ClothingArtwork";

const HOVER_DELAY_MS = 400;
const PREVIEW_WIDTH_PX = 264;
const PREVIEW_HEIGHT_PX = 264;
const PREVIEW_GAP_PX = 18;

function ClothingDetailButton({ item, onViewDetails, className = "" }) {
    const buttonRef = useRef(null);
    const hoverTimerRef = useRef(null);
    const pointerPositionRef = useRef({ x: 0, y: 0 });
    const isHoverVisibleRef = useRef(false);
    const nameViewportRef = useRef(null);
    const nameTextRef = useRef(null);
    const [isHoverVisible, setIsHoverVisible] = useState(false);
    const [isNameOverflowing, setIsNameOverflowing] = useState(false);
    const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
    const canShowDetails = Boolean(item?.productId) && Boolean(onViewDetails);

    useEffect(() => {
        const hoverTarget = buttonRef.current?.parentElement;

        if (!hoverTarget || !canShowDetails) return undefined;

        const updatePointerPosition = (event) => {
            const nextPosition = { x: event.clientX, y: event.clientY };
            pointerPositionRef.current = nextPosition;

            if (isHoverVisibleRef.current) {
                setPointerPosition(nextPosition);
            }
        };
        const hideHoverUi = () => {
            window.clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
            isHoverVisibleRef.current = false;
            setIsHoverVisible(false);
            setIsNameOverflowing(false);
        };
        const handlePointerEnter = (event) => {
            updatePointerPosition(event);
            hideHoverUi();
            hoverTimerRef.current = window.setTimeout(() => {
                setPointerPosition(pointerPositionRef.current);
                isHoverVisibleRef.current = true;
                setIsHoverVisible(true);
                hoverTimerRef.current = null;
            }, HOVER_DELAY_MS);
        };

        hoverTarget.addEventListener("pointerenter", handlePointerEnter);
        hoverTarget.addEventListener("pointermove", updatePointerPosition);
        hoverTarget.addEventListener("pointerleave", hideHoverUi);
        hoverTarget.addEventListener("dragstart", hideHoverUi);

        return () => {
            window.clearTimeout(hoverTimerRef.current);
            hoverTarget.removeEventListener("pointerenter", handlePointerEnter);
            hoverTarget.removeEventListener("pointermove", updatePointerPosition);
            hoverTarget.removeEventListener("pointerleave", hideHoverUi);
            hoverTarget.removeEventListener("dragstart", hideHoverUi);
        };
    }, [canShowDetails]);

    useEffect(() => {
        if (!isHoverVisible) return undefined;

        const frameId = window.requestAnimationFrame(() => {
            const viewport = nameViewportRef.current;
            const text = nameTextRef.current;

            setIsNameOverflowing(Boolean(viewport && text && text.scrollWidth > viewport.clientWidth));
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [isHoverVisible, item?.name]);

    if (!canShowDetails) return null;

    const previewLeft = Math.max(12, Math.min(pointerPosition.x + PREVIEW_GAP_PX, window.innerWidth - PREVIEW_WIDTH_PX - 12));
    const previewTop = Math.max(12, pointerPosition.y - PREVIEW_HEIGHT_PX - PREVIEW_GAP_PX);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                draggable={false}
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    isHoverVisibleRef.current = false;
                    setIsHoverVisible(false);
                    setIsNameOverflowing(false);
                    onViewDetails(item);
                }}
                className={`absolute z-20 flex items-center justify-center rounded-md bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-white shadow-md transition-opacity duration-150 focus-visible:pointer-events-auto focus-visible:opacity-100 ${
                    isHoverVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                } ${className}`}
                aria-label={`${item.name} 상세보기`}
            >
                상세보기
            </button>

            {isHoverVisible &&
                createPortal(
                    <div
                        className="pointer-events-none fixed z-[90] overflow-hidden rounded-2xl shadow-[0_22px_55px_rgba(15,23,42,0.48)] ring-1 ring-black/10"
                        style={{ left: previewLeft, top: previewTop, width: PREVIEW_WIDTH_PX }}
                        aria-hidden="true"
                    >
                        <ClothingArtwork item={item} className="aspect-square w-full" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/50 via-slate-950/30 to-transparent px-3 pb-3 pt-10">
                            <div ref={nameViewportRef} className="overflow-hidden">
                                <div className={isNameOverflowing ? "tier-maker-preview-name-scroll flex w-max" : "w-full"}>
                                    <span ref={nameTextRef} className={`block shrink-0 whitespace-nowrap text-xs font-black text-white ${isNameOverflowing ? "pr-8" : "w-full text-center"}`}>
                                        {item.name}
                                    </span>
                                    {isNameOverflowing && <span className="block shrink-0 whitespace-nowrap pr-8 text-xs font-black text-white">{item.name}</span>}
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}

export default ClothingDetailButton;
