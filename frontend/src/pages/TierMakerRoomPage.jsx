import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { addCandidate, getCandidates } from "@/api/candidates";
import { getProduct } from "@/api/products";
import { finishRoom as finishRoomRequest, getRoomStatus } from "@/api/rooms";
import { createTryOnJob } from "@/api/tryOn";
import { getMyAvatar } from "@/api/users";
import ClothingCatalog from "@/components/tierMaker/ClothingCatalog";
import ClothingAddModal from "@/components/tierMaker/ClothingAddModal";
import FittingPanel from "@/components/tierMaker/FittingPanel";
import ParticipantDock from "@/components/tierMaker/ParticipantDock";
import SharedCursorLayer from "@/components/tierMaker/SharedCursorLayer";
import TierBoard from "@/components/tierMaker/TierBoard";
import TierMakerIcon from "@/components/tierMaker/TierMakerIcon";
import { useRoomEvents } from "@/hooks/useRoomEvents";
import { useToast } from "@/hooks/useToast";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  getRoomSession,
  removeRoomSession,
} from "@/utils/roomSessionStorage";
import {
  createTierMakerClothing,
  normalizeTierMakerSubcategory,
  tierMakerCategoryDetails,
} from "@/utils/tierMakerClothing";

const demoClothes = [
  {
    id: "demo-shirt",
    roomItemId: null,
    productId: null,
    name: "샘플 옥스퍼드 셔츠",
    imageUrl: "",
    slot: "TOP",
    isDemo: true,
    ...tierMakerCategoryDetails.TOP,
    artwork: "shirt",
  },
  {
    id: "demo-knit",
    roomItemId: null,
    productId: null,
    name: "샘플 케이블 니트",
    imageUrl: "",
    slot: "TOP",
    isDemo: true,
    ...tierMakerCategoryDetails.TOP,
    artwork: "knit",
    color: "text-violet-300",
    surface: "bg-violet-50",
  },
  {
    id: "demo-jacket",
    roomItemId: null,
    productId: null,
    name: "샘플 데님 재킷",
    imageUrl: "",
    slot: "OUTER",
    isDemo: true,
    ...tierMakerCategoryDetails.OUTER,
    artwork: "jacket",
    color: "text-blue-700",
    surface: "bg-blue-50",
  },
  {
    id: "demo-cardigan",
    roomItemId: null,
    productId: null,
    name: "샘플 브라운 가디건",
    imageUrl: "",
    slot: "OUTER",
    isDemo: true,
    ...tierMakerCategoryDetails.OUTER,
    artwork: "cardigan",
    color: "text-amber-700",
    surface: "bg-amber-50",
  },
  {
    id: "demo-pants",
    roomItemId: null,
    productId: null,
    name: "샘플 와이드 팬츠",
    imageUrl: "",
    slot: "BOTTOM",
    isDemo: true,
    ...tierMakerCategoryDetails.BOTTOM,
    artwork: "pants",
  },
  {
    id: "demo-sneakers",
    roomItemId: null,
    productId: null,
    name: "샘플 화이트 스니커즈",
    imageUrl: "",
    slot: "SHOES",
    isDemo: true,
    ...tierMakerCategoryDetails.SHOES,
    artwork: "sneakers",
  },
];

const initialDemoPlacements = demoClothes.map((item, index) => ({
  roomItemId: item.id,
  tierId: null,
  position: (index + 1) * 10_000,
}));
const demoItemIds = new Set(demoClothes.map((item) => item.id));

function getMovedDemoPlacements(
  currentPlacements,
  itemId,
  targetTierId,
  requestedIndex,
) {
  const targetPlacements = currentPlacements
    .filter(
      (placement) =>
        placement.roomItemId !== itemId &&
        placement.tierId === targetTierId,
    )
    .sort((left, right) => left.position - right.position);
  const nextIndex = Math.max(
    0,
    Math.min(requestedIndex, targetPlacements.length),
  );

  targetPlacements.splice(nextIndex, 0, {
    roomItemId: itemId,
    tierId: targetTierId,
    position: 0,
  });

  return [
    ...currentPlacements.filter(
      (placement) =>
        placement.roomItemId !== itemId &&
        placement.tierId !== targetTierId,
    ),
    ...targetPlacements.map((placement, index) => ({
      ...placement,
      position: (index + 1) * 10_000,
    })),
  ];
}

const emptyTryOn = {
  status: "IDLE",
  jobId: null,
  resultImageUrl: "",
  reason: "",
};
const BOARD_WIDTH = 1530;
const BOARD_MIN_HEIGHT = 720;

const compareRoomItemId = (left, right) =>
  Number(left.roomItemId) - Number(right.roomItemId);

function getLockConflictMessage(ownerNickname) {
  const owner = ownerNickname ? `${ownerNickname} 사용자가` : "다른 사용자가";
  return `이미 ${owner} 이동하고 있습니다.`;
}

function TierMakerRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const sharedBoardRef = useRef(null);
  const boardViewportRef = useRef(null);
  const completedDropItemIdsRef = useRef(new Set());
  const activeDragRef = useRef(null);
  const cancelledDragItemIdsRef = useRef(new Set());
  const [roomSession] = useState(getRoomSession);
  const [fittingCandidates, setFittingCandidates] = useState([]);
  const [localTryOn, setLocalTryOn] = useState(emptyTryOn);
  const [isClothingModalOpen, setIsClothingModalOpen] = useState(false);
  const [addingProductId, setAddingProductId] = useState(null);
  const [boardScale, setBoardScale] = useState(1);
  const [boardContentHeight, setBoardContentHeight] =
    useState(BOARD_MIN_HEIGHT);
  const isCurrentRoom =
    roomSession && String(roomSession.roomId) === String(roomId);
  const roomEvents = useRoomEvents(isCurrentRoom ? roomSession : null);
  const applyRoomStatus = roomEvents.applyRoomStatus;
  const requestRoomSync = roomEvents.requestSync;
  const roomStatusQuery = useQuery({
    queryKey: ["roomStatus", roomSession?.roomCode],
    queryFn: () =>
      getRoomStatus({
        roomCode: roomSession.roomCode,
        roomToken: roomSession.roomToken,
      }),
    enabled:
      Boolean(isCurrentRoom) &&
      Boolean(roomSession?.roomCode) &&
      Boolean(roomSession?.roomToken) &&
      roomEvents.connectionState === "CONNECTED",
    staleTime: 0,
  });
  const voiceChat = useVoiceChat({
    roomCode: roomSession?.roomCode,
    roomToken: roomSession?.roomToken,
    enabled:
      Boolean(isCurrentRoom) && roomEvents.status === "IN_PROGRESS",
  });
  const candidateQuery = useQuery({
    queryKey: ["candidates", roomId, roomSession?.participantId],
    queryFn: () =>
      getCandidates({
        roomId,
        roomToken: roomSession.roomToken,
      }),
    enabled:
      Boolean(isCurrentRoom) &&
      Boolean(roomSession?.roomToken) &&
      roomEvents.connectionState === "CONNECTED" &&
      roomEvents.status !== "FINISHED" &&
      roomEvents.status !== "EXPIRED",
    staleTime: 30 * 1000,
  });
  const candidateItems = useMemo(
    () =>
      Array.isArray(candidateQuery.data?.data?.items)
        ? candidateQuery.data.data.items
        : [],
    [candidateQuery.data],
  );
  const roomItemRecords = useMemo(() => {
    const roomItemsById = new Map(
      candidateItems.map((item) => [String(item.roomItemId), item]),
    );

    roomEvents.roomItems.forEach((item) => {
      const itemId = String(item.roomItemId);
      roomItemsById.set(itemId, {
        ...roomItemsById.get(itemId),
        ...item,
      });
    });

    return [...roomItemsById.values()];
  }, [candidateItems, roomEvents.roomItems]);

  const productIds = useMemo(
    () => [
      ...new Set(
        roomItemRecords
          .map((roomItem) => roomItem.productId)
          .filter((productId) => productId != null),
      ),
    ],
    [roomItemRecords],
  );
  const productQueries = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: ["products", productId],
      queryFn: () =>
        getProduct({
          roomToken: roomSession.roomToken,
          productId,
        }),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const productsById = Object.fromEntries(
    productQueries
      .map((query, index) => [
        productIds[index],
        query.data?.data,
      ])
      .filter(([, product]) => product),
  );
  const isDemoMode = false;
  const clothes = roomItemRecords.map((roomItem) =>
    createTierMakerClothing(roomItem, productsById[roomItem.productId]),
  );
  const clothesById = Object.fromEntries(
    clothes.map((item) => [item.id, item]),
  );
  const receivedDemoPlacements = Array.isArray(
    roomEvents.sharedDemoPlacements,
  )
    ? roomEvents.sharedDemoPlacements.filter((placement) =>
        demoItemIds.has(String(placement.roomItemId)),
      )
    : [];
  const demoPlacements =
    receivedDemoPlacements.length === demoClothes.length
      ? receivedDemoPlacements
      : initialDemoPlacements;
  const candidatePlacements = roomItemRecords.map((item) => ({
    roomItemId: item.roomItemId,
    tierId: item.tierId,
    position: item.position,
  }));
  const sortedPlacements = [
    ...(roomEvents.hasSnapshot
      ? roomEvents.placements
      : candidatePlacements),
  ].sort((left, right) => left.position - right.position);
  const roomSubcategory =
    roomEvents.subcategory ?? roomStatusQuery.data?.data?.subcategory ?? "";
  const normalizedRoomSubcategory =
    normalizeTierMakerSubcategory(roomSubcategory);
  const tierEligibleClothes = clothes.filter(
    (item) =>
      !normalizedRoomSubcategory ||
      normalizeTierMakerSubcategory(item.subcategory) ===
        normalizedRoomSubcategory,
  );
  const tierEligibleItemIds = new Set(
    tierEligibleClothes.map((item) => item.id),
  );
  const tiers = [...roomEvents.tiers]
    .sort((left, right) => left.position - right.position)
    .map((tier) => ({
      id: String(tier.tierId),
      tierId: tier.tierId,
      name: tier.name,
      itemIds: sortedPlacements
        .filter(
          (placement) =>
            placement.tierId === tier.tierId &&
            tierEligibleItemIds.has(String(placement.roomItemId)),
        )
        .map((placement) => String(placement.roomItemId)),
    }));
  const tieredItemIds = new Set(
    sortedPlacements
      .filter((placement) => placement.tierId != null)
      .map((placement) => String(placement.roomItemId)),
  );
  const waitingClothes = tierEligibleClothes.filter(
    (item) => !tieredItemIds.has(item.id),
  ).sort(compareRoomItemId);
  const fittingOnlyClothes = clothes
    .filter((item) => !tierEligibleItemIds.has(item.id))
    .sort(compareRoomItemId);
  const candidates = fittingCandidates
    .map((itemId) => clothesById[itemId])
    .filter(Boolean);
  const isHost = roomSession?.role === "HOST";
  const isBoardReady =
    roomEvents.hasSnapshot &&
    !roomStatusQuery.isPending &&
    !(roomEvents.status === "IN_PROGRESS" && candidateQuery.isPending);

  useEffect(() => {
    if (!isBoardReady) return undefined;

    const viewport = boardViewportRef.current;
    const board = sharedBoardRef.current;

    if (!viewport || !board) return undefined;

    const updateBoardSize = () => {
      const availableWidth = viewport.clientWidth;
      const nextScale =
        availableWidth > 0
          ? Math.min(1, availableWidth / BOARD_WIDTH)
          : 1;
      const nextHeight = Math.max(BOARD_MIN_HEIGHT, board.offsetHeight);

      setBoardScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.0001
          ? currentScale
          : nextScale,
      );
      setBoardContentHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };
    const resizeObserver = new ResizeObserver(updateBoardSize);

    resizeObserver.observe(viewport);
    resizeObserver.observe(board);
    updateBoardSize();

    return () => resizeObserver.disconnect();
  }, [isBoardReady]);

  useEffect(() => {
    const roomStatus = roomStatusQuery.data?.data;

    if (roomStatus) {
      applyRoomStatus(roomStatus);
    }
  }, [applyRoomStatus, roomStatusQuery.data]);

  useEffect(() => {
    if (
      roomEvents.connectionState === "CONNECTED" &&
      roomStatusQuery.isFetched &&
      !roomStatusQuery.isFetching &&
      candidateQuery.isFetched &&
      !candidateQuery.isFetching
    ) {
      requestRoomSync();
    }
  }, [
    candidateQuery.isFetched,
    candidateQuery.isFetching,
    roomEvents.connectionState,
    requestRoomSync,
    roomStatusQuery.isFetched,
    roomStatusQuery.isFetching,
  ]);

  useEffect(() => {
    if (
      !roomEvents.terminalEvent &&
      roomEvents.hasSnapshot &&
      roomEvents.status === "WAITING"
    ) {
      navigate(`/rooms/${roomId}`, { replace: true });
    }
  }, [
    navigate,
    roomEvents.hasSnapshot,
    roomEvents.status,
    roomEvents.terminalEvent,
    roomId,
  ]);

  useEffect(() => {
    if (!roomEvents.terminalEvent) return;

    removeRoomSession();
    navigate("/rooms", {
      replace: true,
      state: {
        roomNotice:
          roomEvents.terminalEvent === "ROOM_EXPIRED"
            ? "방 이용 시간이 만료되었습니다."
            : "방이 종료되었습니다.",
      },
    });
  }, [navigate, roomEvents.terminalEvent]);

  useEffect(() => {
    const rejection = roomEvents.lockRejection;
    const activeDrag = activeDragRef.current;

    if (!rejection) return;

    if (
      activeDrag &&
      String(activeDrag.roomItemId) ===
      String(rejection.roomItemId)
    ) {
      cancelledDragItemIdsRef.current.add(activeDrag.itemId);
    }

    toast.warning(getLockConflictMessage(rejection.ownerNickname));
  }, [roomEvents.lockRejection, toast]);

  const finishRoomMutation = useMutation({
    mutationFn: async () => {
      const requestFinish = (expectedVersion) =>
        finishRoomRequest({
          roomCode: roomSession.roomCode,
          roomToken: roomSession.roomToken,
          expectedVersion,
        });

      try {
        return await requestFinish(roomEvents.version);
      } catch (error) {
        const errorCode = error.response?.data?.code;

        if (
          error.response?.status !== 409 ||
          (errorCode && errorCode !== "VERSION_CONFLICT")
        ) {
          throw error;
        }

        const snapshot = await requestRoomSync();

        if (!snapshot) {
          throw error;
        }

        return requestFinish(Number(snapshot.version ?? roomEvents.version));
      }
    },
    onError: () => {
      toast.error("방 종료에 실패했습니다.");
    },
  });

  const addCandidateMutation = useMutation({
    mutationFn: (productId) =>
      addCandidate({
        roomToken: roomSession.roomToken,
        roomId: Number(roomId),
        productId,
      }),
    onMutate: (productId) => {
      setAddingProductId(productId);
    },
    onSuccess: () => {
      setIsClothingModalOpen(false);
      candidateQuery.refetch();
      toast.success("후보 의상을 추가했습니다.");
    },
    onSettled: () => {
      setAddingProductId(null);
    },
  });

  const tryOnMutation = useMutation({
    mutationFn: async () => {
      const avatarResponse = await getMyAvatar();
      const avatar = avatarResponse.data;

      return createTryOnJob(
        {
          context: {
            type: "ROOM",
            roomCode: roomSession.roomCode,
            boardVersion: roomEvents.version,
          },
          avatarId: avatar.avatarId,
          items: candidates.map((item) => ({
            roomItemId: item.roomItemId,
            slot: item.slot,
          })),
        },
        crypto.randomUUID(),
      );
    },
    onMutate: () => {
      setLocalTryOn({
        ...emptyTryOn,
        status: "PROCESSING",
      });
    },
    onSuccess: (response) => {
      setLocalTryOn((current) => ({
        ...current,
        status: response.data?.status ?? "PROCESSING",
        jobId: response.data?.jobId ?? null,
      }));
    },
    onError: () => {
      setLocalTryOn(emptyTryOn);
    },
  });
  const visibleTryOn =
    tryOnMutation.isPending ||
    (localTryOn.jobId &&
      roomEvents.tryOn.jobId !== localTryOn.jobId)
      ? localTryOn
      : roomEvents.tryOn.status !== "IDLE"
        ? roomEvents.tryOn
        : localTryOn;

  const handleDragStart = (event, itemId) => {
    const item = clothesById[itemId];
    const lock = roomEvents.itemLocks[itemId];
    const isLockedByOther =
      lock &&
      String(lock.ownerParticipantId) !==
        String(roomSession.participantId);

    if (!item) {
      event.preventDefault();
      return;
    }

    if (isLockedByOther) {
      event.preventDefault();
      toast.warning(getLockConflictMessage(lock.ownerNickname));
      return;
    }

    if (!item.isDemo && !roomEvents.lockItem(item.roomItemId)) {
      event.preventDefault();
      return;
    }

    activeDragRef.current = {
      itemId,
      roomItemId: item.roomItemId,
    };
    cancelledDragItemIdsRef.current.delete(itemId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  };

  const handleDragEnd = (event, itemId) => {
    const item = clothesById[itemId];
    const wasCancelled = cancelledDragItemIdsRef.current.delete(itemId);
    activeDragRef.current = null;

    if (wasCancelled) {
      event.dataTransfer.dropEffect = "none";
    }

    if (completedDropItemIdsRef.current.delete(itemId)) {
      return;
    }

    if (item && !item.isDemo) {
      roomEvents.unlockItem(item.roomItemId, "CANCELLED");
    }
  };

  const moveDemoItem = (itemId, targetTierId, requestedIndex) => {
    const nextPlacements = getMovedDemoPlacements(
      demoPlacements,
      itemId,
      targetTierId,
      requestedIndex,
    );

    roomEvents.shareDemoPlacements(nextPlacements);
  };

  const handleDropTier = (itemId, targetTierId, requestedIndex) => {
    if (cancelledDragItemIdsRef.current.has(itemId)) return;

    const item = clothesById[itemId];
    const targetTier = tiers.find((tier) => tier.id === targetTierId);

    if (!item || !targetTier) return;

    if (!tierEligibleItemIds.has(itemId)) {
      toast.warning(
        `${roomSubcategory || "방"} 상세 카테고리 의상만 티어에 배정할 수 있습니다.`,
      );
      return;
    }

    const targetItemIds = targetTier.itemIds.filter(
      (currentItemId) => currentItemId !== itemId,
    );
    const sourceIndex = targetTier.itemIds.indexOf(itemId);
    const adjustedRequestedIndex =
      requestedIndex != null &&
      sourceIndex !== -1 &&
      sourceIndex < requestedIndex
        ? requestedIndex - 1
        : requestedIndex;
    const nextIndex =
      adjustedRequestedIndex == null
        ? targetItemIds.length
        : Math.min(adjustedRequestedIndex, targetItemIds.length);

    if (item.isDemo) {
      moveDemoItem(itemId, targetTier.tierId, nextIndex);
      return;
    }

    const lock = roomEvents.itemLocks[itemId];
    const isLockedByOther =
      lock &&
      String(lock.ownerParticipantId) !==
        String(roomSession.participantId);

    if (isLockedByOther) return;

    const clientEventId = roomEvents.moveItem({
      roomItemId: item.roomItemId,
      targetTierId: targetTier.tierId,
      newIndex: nextIndex,
    });

    if (clientEventId) {
      completedDropItemIdsRef.current.add(itemId);
    }
  };

  const handleUnrank = (itemId) => {
    const item = clothesById[itemId];

    if (!item) return;

    if (!tierEligibleItemIds.has(itemId)) {
      toast.warning("이 의상은 가상 피팅에만 사용할 수 있습니다.");
      return;
    }

    const nextIndex = sortedPlacements.filter(
      (placement) =>
        placement.tierId == null &&
        String(placement.roomItemId) !== itemId,
    ).length;

    if (item.isDemo) {
      moveDemoItem(itemId, null, nextIndex);
      return;
    }

    const lock = roomEvents.itemLocks[itemId];
    const isLockedByOther =
      lock &&
      String(lock.ownerParticipantId) !==
        String(roomSession.participantId);
    const isActiveDrag =
      String(activeDragRef.current?.itemId) === String(itemId);

    if (
      isLockedByOther ||
      (!isActiveDrag && !roomEvents.lockItem(item.roomItemId))
    ) {
      return;
    }

    const clientEventId = roomEvents.moveItem({
      roomItemId: item.roomItemId,
      targetTierId: null,
      newIndex: nextIndex,
    });

    if (isActiveDrag && clientEventId) {
      completedDropItemIdsRef.current.add(itemId);
    }
  };

  const handleDropCandidate = (itemId) => {
    if (cancelledDragItemIdsRef.current.has(itemId)) return;

    const nextItem = clothesById[itemId];

    if (!nextItem) return;

    setFittingCandidates((currentItems) => [
      ...currentItems.filter(
        (currentItemId) =>
          clothesById[currentItemId]?.category !== nextItem.category,
      ),
      itemId,
    ]);
  };

  const handleRenameTier = (tierId, name) => {
    const tier = tiers.find((currentTier) => currentTier.id === tierId);

    if (!tier) return;

    roomEvents.renameTier({
      tierId: tier.tierId,
      name,
    });
  };

  const handleAddProduct = (product) => {
    const productId = product.productId ?? product.id;

    if (productId == null || addCandidateMutation.isPending) return;

    addCandidateMutation.mutate(productId);
  };

  const handleFinishRoom = () => {
    if (!window.confirm("티어메이킹 방을 종료할까요?")) return;

    finishRoomMutation.mutate();
  };

  const handleBoardPointerMove = (event) => {
    const board = sharedBoardRef.current;

    if (!board) return;

    const bounds = board.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) return;

    roomEvents.moveCursor({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    });
  };

  if (!isCurrentRoom) {
    return (
      <main className="flex min-h-screen items-center bg-slate-100 px-4">
        <section className="mx-auto max-w-md rounded-3xl border bg-white p-8 text-center shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-bold">방 참여 정보가 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            방을 만들거나 방 코드로 참여한 뒤 다시 시도해 주세요.
          </p>
          <Link
            to="/rooms"
            className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white"
          >
            방 선택으로 이동
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white shadow-lg shadow-violet-200">
              T
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-extrabold text-slate-900 sm:text-base">
                  실시간 티어메이커
                </h1>
                <span
                  className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline-flex ${
                    roomEvents.connectionState === "CONNECTED"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {roomEvents.connectionState === "CONNECTED"
                    ? "참여 중"
                    : "연결 중"}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>스타일 보드</span>
                <TierMakerIcon name="chevron" size={11} />
                <span className="font-medium text-slate-500">
                  ROOM {roomSession.roomCode ?? roomId}
                </span>
                <span>· v{roomEvents.version}</span>
              </div>
            </div>
          </div>

          {isHost && (
            <button
              type="button"
              onClick={handleFinishRoom}
              disabled={
                roomEvents.connectionState !== "CONNECTED" ||
                !roomEvents.hasSnapshot ||
                roomEvents.status !== "IN_PROGRESS" ||
                finishRoomMutation.isPending
              }
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TierMakerIcon name="door" size={16} />
              {finishRoomMutation.isPending ? "종료 중..." : "보드 종료"}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {(roomEvents.connectionError ||
          roomStatusQuery.isError ||
          candidateQuery.isError ||
          productQueries.some((query) => query.isError)) && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {roomEvents.connectionError ||
              (roomStatusQuery.isError
                ? getApiErrorMessage(
                    roomStatusQuery.error,
                    "방 상태를 불러오지 못했습니다.",
                  )
                : candidateQuery.isError
                ? getApiErrorMessage(
                    candidateQuery.error,
                    "후보 상품을 불러오지 못했습니다.",
                  )
                : "일부 상품 정보를 불러오지 못했습니다.")}
          </p>
        )}

        {!isBoardReady ? (
          <section className="flex min-h-96 items-center justify-center rounded-3xl border bg-white">
            <div className="text-center">
              <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
              <p className="mt-4 text-sm font-semibold text-slate-600">
                최신 보드 상태를 불러오고 있어요
              </p>
            </div>
          </section>
        ) : (
          <>
            {isDemoMode && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                방 의상이 없어 프론트 테스트용 샘플을 표시하고
                있습니다. 샘플 배치는 같은 방에 실시간 공유되지만
                저장되지는 않습니다.
              </p>
            )}
            <div ref={boardViewportRef} className="w-full pb-2">
              <div
                className="mx-auto"
                style={{
                  width: `${BOARD_WIDTH * boardScale}px`,
                  height: `${boardContentHeight * boardScale}px`,
                }}
              >
                <div
                  ref={sharedBoardRef}
                  onPointerMove={handleBoardPointerMove}
                  onDragOverCapture={handleBoardPointerMove}
                  className="relative grid min-h-[720px] w-[1530px] cursor-none grid-cols-[280px_900px_310px] items-start gap-5 [&_*]:cursor-none"
                  style={{
                    transform: `scale(${boardScale})`,
                    transformOrigin: "top left",
                  }}
                >
                <SharedCursorLayer
                  cursors={roomEvents.cursors}
                  participants={roomEvents.participants}
                  currentParticipantId={roomSession.participantId}
                  itemLocks={roomEvents.itemLocks}
                  clothesById={clothesById}
                />
                <FittingPanel
                  candidates={candidates}
                  onDropCandidate={handleDropCandidate}
                  onRemoveCandidate={(itemId) =>
                    setFittingCandidates((currentItems) =>
                      currentItems.filter((id) => id !== itemId),
                    )
                  }
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onGenerate={() => tryOnMutation.mutate()}
                  canGenerate={
                    !isDemoMode &&
                    isHost &&
                    Boolean(roomSession.roomCode) &&
                    roomEvents.connectionState === "CONNECTED"
                  }
                  generateDisabledMessage={
                    isDemoMode
                      ? "샘플 의상은 가상 피팅을 생성할 수 없어요"
                      : isHost
                      ? "방 연결 후 생성할 수 있어요"
                      : "방장만 생성할 수 있어요"
                  }
                  isSubmitting={tryOnMutation.isPending}
                  tryOn={visibleTryOn}
                  errorMessage={
                    tryOnMutation.isError
                      ? getApiErrorMessage(
                          tryOnMutation.error,
                          "가상 피팅 요청에 실패했습니다.",
                        )
                      : ""
                  }
                />
                <TierBoard
                  tiers={tiers}
                  clothesById={clothesById}
                  onDropTier={handleDropTier}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  itemLocks={roomEvents.itemLocks}
                  currentParticipantId={roomSession.participantId}
                  canRename={isHost}
                  onRenameTier={handleRenameTier}
                  waitingClothes={waitingClothes}
                  roomSubcategory={roomSubcategory}
                  onUnrank={handleUnrank}
                />
                <ClothingCatalog
                  clothes={fittingOnlyClothes}
                  itemLocks={roomEvents.itemLocks}
                  currentParticipantId={roomSession.participantId}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onAddClothing={() => {
                    addCandidateMutation.reset();
                    setIsClothingModalOpen(true);
                  }}
                />
                </div>
              </div>
            </div>

            <ParticipantDock
              participants={roomEvents.participants}
              currentParticipantId={roomSession.participantId}
              maxParticipants={roomSession.maxParticipants ?? 4}
              isConnected={
                roomEvents.connectionState === "CONNECTED"
              }
              isMicMuted={voiceChat.isMicMuted}
              isSpeakerMuted={voiceChat.isSpeakerMuted}
              isMicControlPending={voiceChat.isMicControlPending}
              voiceConnectionState={voiceChat.connectionState}
              voiceError={
                voiceChat.connectionError || voiceChat.microphoneError
              }
              needsAudioStart={voiceChat.needsAudioStart}
              onToggleMic={voiceChat.toggleMicrophone}
              onToggleSpeaker={voiceChat.toggleSpeaker}
              onStartAudio={voiceChat.startAudio}
              onRetryVoice={voiceChat.retryConnection}
            />
          </>
        )}
      </div>
      {isClothingModalOpen && (
        <ClothingAddModal
          roomToken={roomSession.roomToken}
          onClose={() => setIsClothingModalOpen(false)}
          onAdd={handleAddProduct}
          isAdding={addCandidateMutation.isPending}
          addingProductId={addingProductId}
          addError={addCandidateMutation.error}
        />
      )}
    </main>
  );
}

export default TierMakerRoomPage;
