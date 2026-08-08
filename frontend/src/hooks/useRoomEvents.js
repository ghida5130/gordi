import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";

const ROOM_TOPIC_PREFIX = "/topic/v1/rooms";
const ROOM_SYNC_QUEUE = "/user/queue/sync";
const CURSOR_PUBLISH_INTERVAL_MS = 50;
const CURSOR_STALE_TIME_MS = 5_000;

function createWebSocketUrl(webSocketPath) {
    if (/^wss?:\/\//.test(webSocketPath)) {
        return webSocketPath;
    }

    const apiUrl = new URL(import.meta.env.VITE_API_BASE_URL ?? "http://localhost/api", window.location.origin);
    const webSocketUrl = new URL(webSocketPath, apiUrl.origin);
    webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";
    return webSocketUrl.toString();
}

function getInitialParticipant(roomSession) {
    return {
        participantId: roomSession.participantId,
        nickname: roomSession.nickname ?? (roomSession.role === "HOST" ? "방장" : "참여자"),
        role: roomSession.role,
    };
}

function createInitialState(roomSession) {
    return {
        participants: roomSession ? [getInitialParticipant(roomSession)] : [],
        status: roomSession?.status ?? "WAITING",
        category: roomSession?.category ?? null,
        version: Number(roomSession?.version ?? 0),
        tiers: [],
        roomItems: [],
        placements: [],
        fittingCandidates: [],
        fittingDraft: null,
        removedRoomItemIds: [],
        itemRemoval: null,
        itemLocks: {},
        lockRejection: null,
        tryOn: {
            status: "IDLE",
            jobId: null,
            resultImageUrl: "",
            reason: "",
        },
        terminalEvent: null,
        hasSnapshot: false,
        pendingEvents: [],
    };
}

function updateParticipants(currentParticipants, eventType, data) {
    if (eventType === "PARTICIPANT_JOINED") {
        return [...currentParticipants.filter((participant) => participant.participantId !== data.participantId), data];
    }

    if (eventType === "PARTICIPANT_LEFT") {
        return currentParticipants.filter((participant) => participant.participantId !== data.participantId);
    }

    return currentParticipants;
}

function upsertRoomItem(currentRoomItems, item) {
    if (item?.roomItemId == null) return currentRoomItems;

    return [
        ...currentRoomItems.filter((currentItem) => String(currentItem.roomItemId) !== String(item.roomItemId)),
        item,
    ];
}

function removeRoomItem(state, event, data, nextVersion, pendingEvents) {
    const roomItemKey = String(data.roomItemId);
    const itemLocks = { ...state.itemLocks };
    const removedItem = state.roomItems.find((item) => String(item.roomItemId) === roomItemKey);

    delete itemLocks[roomItemKey];

    return {
        ...state,
        roomItems: state.roomItems.filter((item) => String(item.roomItemId) !== roomItemKey),
        placements: state.placements.filter((placement) => String(placement.roomItemId) !== roomItemKey),
        fittingCandidates: state.fittingCandidates.filter((candidate) => String(candidate.roomItemId) !== roomItemKey),
        removedRoomItemIds: [...new Set([...state.removedRoomItemIds, roomItemKey])],
        itemRemoval: {
            eventId: event.eventId ?? null,
            roomItemId: data.roomItemId,
            productId: data.productId,
            name: removedItem?.name ?? null,
            senderParticipantId: event.senderParticipantId,
        },
        itemLocks,
        version: nextVersion,
        ...(pendingEvents ? { pendingEvents } : {}),
    };
}

function normalizeFittingDraft(data, event = {}) {
    return {
        draftRevision: Number(data?.draftRevision ?? 0),
        sizeSelections: Array.isArray(data?.sizeSelections) ? data.sizeSelections : [],
        wearOptions: {
            topTuck: data?.wearOptions?.topTuck ?? null,
            outerClosure: data?.wearOptions?.outerClosure ?? null,
            sleeves: data?.wearOptions?.sleeves ?? null,
        },
        prompt: data?.prompt ?? "",
        eventId: event.eventId ?? null,
        clientEventId: event.clientEventId ?? null,
        senderParticipantId: event.senderParticipantId ?? null,
    };
}

function applyFittingDraft(state, event, data, nextVersion, pendingEvents) {
    const nextDraft = normalizeFittingDraft(data, event);
    const currentDraftRevision = Number(state.fittingDraft?.draftRevision ?? -1);

    if (state.fittingDraft && nextDraft.draftRevision < currentDraftRevision) {
        return state;
    }

    return {
        ...state,
        fittingDraft: nextDraft,
        version: nextVersion,
        ...(pendingEvents ? { pendingEvents } : {}),
    };
}

function normalizeSnapshot(data) {
    const tiers = Array.isArray(data.tiers) ? data.tiers : [];
    const unclassifiedItems = Array.isArray(data.unclassifiedItems) ? data.unclassifiedItems : [];
    const status = data.status ?? "WAITING";
    const tierItems = tiers.flatMap((tier) =>
        (tier.items ?? []).map((item) => ({
            ...item,
            tierId: tier.tierId,
        })),
    );
    const roomItems = [...tierItems, ...unclassifiedItems].map((item) => ({
        roomItemId: item.roomItemId,
        productId: item.productId,
    }));
    const placements = [
        ...tierItems.map((item) => ({
            roomItemId: item.roomItemId,
            tierId: item.tierId,
            position: item.position,
        })),
        ...unclassifiedItems.map((item) => ({
            roomItemId: item.roomItemId,
            tierId: null,
            position: item.position,
        })),
    ];

    const fittingDraftData = data.fittingDraft ?? (
        data.draftRevision != null ? data : null
    );

    return {
        participants: Array.isArray(data.participants) ? data.participants : [],
        status,
        terminalEvent: status === "FINISHED" ? "ROOM_FINISHED" : status === "EXPIRED" ? "ROOM_EXPIRED" : null,
        tiers: tiers.map(({ tierId, name, position }) => ({
            tierId,
            name,
            position,
        })),
        roomItems,
        placements,
        fittingCandidates: Array.isArray(data.fittingCandidates) ? data.fittingCandidates : [],
        ...(fittingDraftData
            ? { fittingDraft: normalizeFittingDraft(fittingDraftData) }
            : {}),
        removedRoomItemIds: [],
    };
}

function roomEventReducer(state, event) {
    const eventType = event.eventType;
    const data = event.data ?? {};
    const nextVersion = Math.max(state.version, Number(event.version ?? 0));

    if (eventType === "BOARD_SNAPSHOT") {
        const snapshotVersion = Number(event.version ?? 0);

        if (state.hasSnapshot && snapshotVersion < state.version) {
            return state;
        }

        let nextState = {
            ...state,
            ...normalizeSnapshot(data),
            category: data.category ?? state.category,
            version: snapshotVersion,
            hasSnapshot: true,
            pendingEvents: [],
        };

        state.pendingEvents
            .filter((pendingEvent) => {
                if (pendingEvent.eventType === "FITTING_DRAFT_UPDATED") {
                    return Number(pendingEvent.data?.draftRevision ?? 0) >
                        Number(nextState.fittingDraft?.draftRevision ?? -1);
                }

                return Number(pendingEvent.version ?? 0) > snapshotVersion;
            })
            .forEach((pendingEvent) => {
                nextState = roomEventReducer(nextState, pendingEvent);
            });

        return nextState;
    }

    if (eventType === "ROOM_STATUS_LOADED") {
        const statusVersion = Number(event.version ?? 0);

        if (state.hasSnapshot && statusVersion < state.version) {
            return state;
        }

        const status = data.status ?? state.status;

        return {
            ...state,
            status,
            category: data.category ?? state.category,
            terminalEvent: status === "FINISHED" ? "ROOM_FINISHED" : status === "EXPIRED" ? "ROOM_EXPIRED" : state.terminalEvent,
            participants: Array.isArray(data.participants) ? data.participants : state.participants,
            tiers: Array.isArray(data.tiers)
                ? data.tiers.map(({ tierId, name, position }) => ({ tierId, name, position }))
                : state.tiers,
            version: nextVersion,
        };
    }

    if (eventType === "ITEM_LOCKED") {
        return {
            ...state,
            itemLocks: {
                ...state.itemLocks,
                [String(data.roomItemId)]: {
                    roomItemId: data.roomItemId,
                    ownerParticipantId: data.ownerParticipantId,
                    ownerNickname: data.ownerNickname,
                },
            },
            lockRejection: String(state.lockRejection?.roomItemId) === String(data.roomItemId) ? null : state.lockRejection,
        };
    }

    if (eventType === "ITEM_LOCK_REJECTED") {
        return {
            ...state,
            itemLocks: {
                ...state.itemLocks,
                [String(data.roomItemId)]: {
                    roomItemId: data.roomItemId,
                    ownerParticipantId: data.ownerParticipantId,
                    ownerNickname: data.ownerNickname,
                },
            },
            lockRejection: {
                roomItemId: data.roomItemId,
                code: data.code,
                ownerParticipantId: data.ownerParticipantId,
                ownerNickname: data.ownerNickname,
            },
        };
    }

    if (eventType === "ITEM_UNLOCKED") {
        const itemLocks = { ...state.itemLocks };
        delete itemLocks[String(data.roomItemId)];

        return {
            ...state,
            itemLocks,
        };
    }

    if (!state.hasSnapshot) {
        const pendingEvents = [...state.pendingEvents, event];

        if (eventType === "PARTICIPANT_JOINED" || eventType === "PARTICIPANT_LEFT") {
            return {
                ...state,
                participants: updateParticipants(state.participants, eventType, data),
                version: nextVersion,
                pendingEvents,
            };
        }

        if (eventType === "ROOM_STARTED") {
            return {
                ...state,
                status: data.status ?? "IN_PROGRESS",
                version: nextVersion,
                pendingEvents,
            };
        }

        if (eventType === "ITEM_ADDED") {
            return {
                ...state,
                roomItems: upsertRoomItem(state.roomItems, data.item),
                placements: Array.isArray(data.placements) ? data.placements : state.placements,
                removedRoomItemIds: state.removedRoomItemIds.filter(
                    (roomItemId) => String(roomItemId) !== String(data.item?.roomItemId),
                ),
                version: nextVersion,
                pendingEvents,
            };
        }

        if (eventType === "ITEM_REMOVED") {
            return removeRoomItem(state, event, data, nextVersion, pendingEvents);
        }

        if (eventType === "FITTING_CANDIDATES_UPDATED") {
            return {
                ...state,
                fittingCandidates: Array.isArray(data.fittingCandidates) ? data.fittingCandidates : [],
                version: nextVersion,
                pendingEvents,
            };
        }

        if (eventType === "FITTING_DRAFT_UPDATED") {
            return applyFittingDraft(state, event, data, nextVersion, pendingEvents);
        }

        if (eventType === "ROOM_FINISHED" || eventType === "ROOM_EXPIRED") {
            return {
                ...state,
                status: eventType === "ROOM_FINISHED" ? "FINISHED" : "EXPIRED",
                terminalEvent: eventType,
                version: nextVersion,
                pendingEvents,
            };
        }

        return {
            ...state,
            version: nextVersion,
            pendingEvents,
        };
    }

    if (state.hasSnapshot && Number(event.version ?? 0) < state.version) {
        return state;
    }

    if (eventType === "PARTICIPANT_JOINED" || eventType === "PARTICIPANT_LEFT") {
        return {
            ...state,
            participants: updateParticipants(state.participants, eventType, data),
            version: nextVersion,
        };
    }

    if (eventType === "ROOM_STARTED") {
        return {
            ...state,
            status: data.status ?? "IN_PROGRESS",
            version: nextVersion,
        };
    }

    if (eventType === "ITEM_MOVED") {
        return {
            ...state,
            placements: Array.isArray(data.placements) ? data.placements : state.placements,
            version: nextVersion,
        };
    }

    if (eventType === "ITEM_ADDED") {
        return {
            ...state,
            roomItems: upsertRoomItem(state.roomItems, data.item),
            placements: Array.isArray(data.placements) ? data.placements : state.placements,
            removedRoomItemIds: state.removedRoomItemIds.filter(
                (roomItemId) => String(roomItemId) !== String(data.item?.roomItemId),
            ),
            version: nextVersion,
        };
    }

    if (eventType === "ITEM_REMOVED") {
        return removeRoomItem(state, event, data, nextVersion);
    }

    if (eventType === "FITTING_CANDIDATES_UPDATED") {
        return {
            ...state,
            fittingCandidates: Array.isArray(data.fittingCandidates) ? data.fittingCandidates : [],
            version: nextVersion,
        };
    }

    if (eventType === "FITTING_DRAFT_UPDATED") {
        return applyFittingDraft(state, event, data, nextVersion);
    }

    if (eventType === "TIER_RENAMED") {
        return {
            ...state,
            tiers: state.tiers.map((tier) => (tier.tierId === data.tierId ? { ...tier, name: data.name } : tier)),
            version: nextVersion,
        };
    }

    if (eventType === "TRY_ON_PROCESSING" || eventType === "TRY_ON_PROGRESSING") {
        return {
            ...state,
            tryOn: {
                status: "PROCESSING",
                jobId: data.jobId ?? null,
                resultImageUrl: "",
                reason: "",
            },
            version: nextVersion,
        };
    }

    if (eventType === "TRY_ON_SUCCEEDED") {
        return {
            ...state,
            tryOn: {
                status: "SUCCEEDED",
                jobId: data.jobId ?? null,
                resultImageUrl: data.resultImageUrl ?? "",
                reason: "",
            },
            version: nextVersion,
        };
    }

    if (eventType === "TRY_ON_FAILED") {
        return {
            ...state,
            tryOn: {
                status: "FAILED",
                jobId: data.jobId ?? null,
                resultImageUrl: "",
                reason: data.reason ?? "가상 피팅에 실패했습니다.",
            },
            version: nextVersion,
        };
    }

    if (eventType === "ROOM_FINISHED" || eventType === "ROOM_EXPIRED") {
        return {
            ...state,
            status: eventType === "ROOM_FINISHED" ? "FINISHED" : "EXPIRED",
            terminalEvent: eventType,
            version: nextVersion,
        };
    }

    return {
        ...state,
        version: nextVersion,
    };
}

// - 인자: roomId와 roomToken 등을 포함한 방 세션
// - 동작: 방 이벤트·커서 구독, 상태 동기화, 공동 편집 명령 전송 관리
export function useRoomEvents(roomSession) {
    const roomId = roomSession?.roomId;
    const clientRef = useRef(null);
    const processedEventIdsRef = useRef(new Set());
    const ownedLockTokensRef = useRef(new Map());
    const versionRef = useRef(Number(roomSession?.version ?? 0));
    const draftRevisionRef = useRef(0);
    const hasSnapshotRef = useRef(false);
    const activeSyncRequestRef = useRef(null);
    const deferredEventsRef = useRef([]);
    const lastCursorPublishAtRef = useRef(0);
    const pendingCursorRef = useRef(null);
    const cursorPublishTimerRef = useRef(null);
    const [roomState, dispatch] = useReducer(roomEventReducer, roomSession, createInitialState);
    const [cursors, setCursors] = useState({});
    const [sharedDemoPlacements, setSharedDemoPlacements] = useState(null);
    const [connectionState, setConnectionState] = useState(() => (roomSession?.roomToken && roomSession?.roomId ? "CONNECTING" : "DISCONNECTED"));
    const [connectionError, setConnectionError] = useState("");

    const requestSync = useCallback(() => {
        if (activeSyncRequestRef.current) {
            return activeSyncRequestRef.current.promise;
        }

        const client = clientRef.current;

        if (!client?.connected || !roomId) {
            return Promise.resolve(null);
        }

        const clientEventId = crypto.randomUUID();
        let resolveRequest;
        const promise = new Promise((resolve) => {
            resolveRequest = resolve;
        });
        const timer = window.setTimeout(() => {
            if (activeSyncRequestRef.current?.clientEventId !== clientEventId) return;

            activeSyncRequestRef.current = null;
            setConnectionError("방 상태 동기화 응답을 받지 못했습니다.");
            resolveRequest(null);
        }, 5_000);

        activeSyncRequestRef.current = {
            clientEventId,
            promise,
            resolve: resolveRequest,
            timer,
        };
        client.publish({
            destination: `/app/rooms/${roomId}/sync`,
            body: JSON.stringify({ clientEventId }),
        });
        return promise;
    }, [roomId]);

    useEffect(() => {
        versionRef.current = roomState.version;
    }, [roomState.version]);

    useEffect(() => {
        draftRevisionRef.current = Math.max(
            draftRevisionRef.current,
            Number(roomState.fittingDraft?.draftRevision ?? 0),
        );
    }, [roomState.fittingDraft?.draftRevision]);

    useEffect(() => {
        const staleCursorTimer = window.setInterval(() => {
            const staleBefore = Date.now() - CURSOR_STALE_TIME_MS;

            setCursors((currentCursors) => {
                const activeCursors = Object.entries(currentCursors).filter(([, cursor]) => cursor.updatedAt >= staleBefore);

                return activeCursors.length === Object.keys(currentCursors).length ? currentCursors : Object.fromEntries(activeCursors);
            });
        }, 1_000);

        return () => window.clearInterval(staleCursorTimer);
    }, []);

    useEffect(() => {
        if (!roomSession?.roomToken || !roomSession?.roomId) {
            return undefined;
        }

        const ownedLockTokens = ownedLockTokensRef.current;

        const applyEvent = (event) => {
            dispatch(event);

            const eventVersion = Number(event.version);

            if (Number.isFinite(eventVersion)) {
                versionRef.current = Math.max(versionRef.current, eventVersion);
            }
        };

        const completeSyncRequest = (event) => {
            const activeRequest = activeSyncRequestRef.current;

            if (!activeRequest) return;

            window.clearTimeout(activeRequest.timer);
            activeSyncRequestRef.current = null;
            activeRequest.resolve(event);
        };

        const applySnapshot = (event) => {
            const snapshotVersion = Number(event.version ?? 0);

            if (hasSnapshotRef.current && snapshotVersion < versionRef.current) {
                return;
            }

            applyEvent(event);
            hasSnapshotRef.current = true;
            setConnectionError("");
            completeSyncRequest(event);

            const deferredEvents = deferredEventsRef.current
                .sort((left, right) => Number(left.version ?? 0) - Number(right.version ?? 0));
            deferredEventsRef.current = [];
            let replayVersion = Math.max(versionRef.current, snapshotVersion);

            for (let index = 0; index < deferredEvents.length; index += 1) {
                const deferredEvent = deferredEvents[index];

                if (deferredEvent.eventType === "FITTING_DRAFT_UPDATED") {
                    applyEvent(deferredEvent);
                    continue;
                }

                const deferredVersion = Number(deferredEvent.version);

                if (!Number.isFinite(deferredVersion) || deferredVersion <= replayVersion) {
                    continue;
                }

                if (deferredVersion > replayVersion + 1) {
                    deferredEventsRef.current = deferredEvents.slice(index);
                    requestSync();
                    break;
                }

                applyEvent(deferredEvent);
                replayVersion = deferredVersion;
            }
        };

        const handleMessage = (message) => {
            try {
                const event = JSON.parse(message.body);

                if (String(event.roomId) !== String(roomSession.roomId)) {
                    return;
                }

                if (event.eventId && processedEventIdsRef.current.has(event.eventId)) {
                    return;
                }

                if (event.eventId) {
                    processedEventIdsRef.current.add(event.eventId);
                }

                if (event.eventType === "BOARD_SNAPSHOT") {
                    applySnapshot(event);
                    return;
                }

                if (event.eventType === "PARTICIPANT_LEFT") {
                    setCursors((currentCursors) => {
                        const nextCursors = { ...currentCursors };
                        delete nextCursors[String(event.data?.participantId)];
                        return nextCursors;
                    });
                }

                if (event.eventType === "ITEM_LOCK_REJECTED") {
                    const itemKey = String(event.data?.roomItemId);
                    const ownedLock = ownedLockTokensRef.current.get(itemKey);

                    if (ownedLock?.clientEventId === event.clientEventId) {
                        ownedLockTokensRef.current.delete(itemKey);
                    }
                }

                if (event.eventType === "ITEM_UNLOCKED") {
                    const itemKey = String(event.data?.roomItemId);
                    const ownedLock = ownedLockTokensRef.current.get(itemKey);

                    if (ownedLock?.moveClientEventId === event.clientEventId) {
                        ownedLockTokensRef.current.delete(itemKey);
                    }
                }

                const eventVersion = Number(event.version);
                const hasEventVersion = Number.isFinite(eventVersion);

                if (
                    hasSnapshotRef.current &&
                    hasEventVersion &&
                    (activeSyncRequestRef.current || eventVersion > versionRef.current + 1)
                ) {
                    deferredEventsRef.current.push(event);
                    requestSync();
                    return;
                }

                applyEvent(event);
            } catch {
                setConnectionError("방 이벤트를 해석하지 못했습니다.");
            }
        };

        const handleCursorMessage = (message) => {
            try {
                const cursor = JSON.parse(message.body);
                const participantId = String(cursor.participantId);
                const x = Number(cursor.x);
                const y = Number(cursor.y);

                if (participantId === String(roomSession.participantId) || !Number.isFinite(x) || !Number.isFinite(y)) {
                    return;
                }

                setCursors((currentCursors) => ({
                    ...currentCursors,
                    [participantId]: {
                        participantId: cursor.participantId,
                        x: Math.max(0, Math.min(1, x)),
                        y: Math.max(0, Math.min(1, y)),
                        updatedAt: Date.now(),
                    },
                }));
            } catch {
                setConnectionError("커서 위치를 해석하지 못했습니다.");
            }
        };

        const handleDemoPlacementsMessage = (message) => {
            try {
                const payload = JSON.parse(message.body);

                if (String(payload.senderParticipantId) === String(roomSession.participantId) || !Array.isArray(payload.placements)) {
                    return;
                }

                setSharedDemoPlacements(payload.placements);
            } catch {
                setConnectionError("샘플 배치를 해석하지 못했습니다.");
            }
        };

        // - 방 이벤트와 커서, 개인 동기화 응답 구독 관리
        const client = new Client({
            brokerURL: createWebSocketUrl(roomSession.webSocketUrl ?? "/ws/v1"),
            connectHeaders: {
                Authorization: `Bearer ${roomSession.roomToken}`,
            },
            heartbeatIncoming: 10_000,
            heartbeatOutgoing: 10_000,
            reconnectDelay: 5_000,
            onConnect: () => {
                setConnectionState("CONNECTED");
                setConnectionError("");
                setCursors({});
                setSharedDemoPlacements(null);

                client.subscribe(`${ROOM_TOPIC_PREFIX}/${roomSession.roomId}/participants`, handleMessage, {
                    id: "sub-room-events",
                    ack: "auto",
                });
                client.subscribe(ROOM_SYNC_QUEUE, handleMessage, {
                    id: "sub-sync",
                    ack: "auto",
                });
                client.subscribe("/user/queue/item-locks", handleMessage, {
                    id: "sub-item-locks",
                    ack: "auto",
                });
                client.subscribe(`${ROOM_TOPIC_PREFIX}/${roomSession.roomId}/cursors`, handleCursorMessage, {
                    id: "sub-room-cursors",
                    ack: "auto",
                });
                client.subscribe(`${ROOM_TOPIC_PREFIX}/${roomSession.roomId}/demo-placements`, handleDemoPlacementsMessage, {
                    id: "sub-room-demo-placements",
                    ack: "auto",
                });
            },
            onStompError: (frame) => {
                setConnectionState("ERROR");
                setConnectionError(frame.headers.message ?? "방 연결에 실패했습니다.");
            },
            onWebSocketError: () => {
                setConnectionState("ERROR");
                setConnectionError("방 연결에 실패했습니다.");
            },
            onWebSocketClose: () => {
                const activeSyncRequest = activeSyncRequestRef.current;

                if (activeSyncRequest) {
                    window.clearTimeout(activeSyncRequest.timer);
                    activeSyncRequest.resolve(null);
                    activeSyncRequestRef.current = null;
                }

                setConnectionState("DISCONNECTED");
            },
        });

        clientRef.current = client;
        client.activate();

        return () => {
            const activeSyncRequest = activeSyncRequestRef.current;

            if (activeSyncRequest) {
                window.clearTimeout(activeSyncRequest.timer);
                activeSyncRequest.resolve(null);
                activeSyncRequestRef.current = null;
            }

            clientRef.current = null;
            ownedLockTokens.clear();
            deferredEventsRef.current = [];
            hasSnapshotRef.current = false;
            lastCursorPublishAtRef.current = 0;
            pendingCursorRef.current = null;

            if (cursorPublishTimerRef.current !== null) {
                window.clearTimeout(cursorPublishTimerRef.current);
                cursorPublishTimerRef.current = null;
            }

            client.deactivate();
        };
    }, [requestSync, roomSession]);

    const publishCommand = useCallback(
        (destination, data) => {
            if (!clientRef.current?.connected) {
                setConnectionError("방 연결 후 다시 시도해 주세요.");
                return null;
            }

            const clientEventId = crypto.randomUUID();
            clientRef.current.publish({
                destination: `/app/rooms/${roomId}/${destination}`,
                body: JSON.stringify({
                    clientEventId,
                    baseVersion: versionRef.current,
                    data,
                }),
            });
            return clientEventId;
        },
        [roomId],
    );

    const applyRoomStatus = useCallback((roomStatus) => {
        if (!roomStatus) return;

        const statusVersion = Number(roomStatus.version ?? 0);
        versionRef.current = Math.max(versionRef.current, statusVersion);
        dispatch({
            eventType: "ROOM_STATUS_LOADED",
            version: statusVersion,
            data: roomStatus,
        });
    }, []);

    const startRoom = useCallback(() => publishCommand("start", {}), [publishCommand]);

    const lockItem = useCallback(
        (roomItemId) => {
            const client = clientRef.current;

            if (!client?.connected || roomItemId == null) {
                setConnectionError("방 연결 후 다시 시도해 주세요.");
                return null;
            }

            const clientEventId = crypto.randomUUID();
            const lockToken = crypto.randomUUID();
            setConnectionError("");
            ownedLockTokensRef.current.set(String(roomItemId), {
                clientEventId,
                lockToken,
            });
            client.publish({
                destination: `/app/rooms/${roomId}/items/lock`,
                body: JSON.stringify({
                    clientEventId,
                    data: {
                        roomItemId,
                        lockToken,
                    },
                }),
            });
            return clientEventId;
        },
        [roomId],
    );

    const unlockItem = useCallback(
        (roomItemId, reason = "CANCELLED") => {
            const client = clientRef.current;
            const itemKey = String(roomItemId);
            const ownedLock = ownedLockTokensRef.current.get(itemKey);

            if (!client?.connected || !ownedLock) {
                return false;
            }

            ownedLockTokensRef.current.delete(itemKey);
            client.publish({
                destination: `/app/rooms/${roomId}/items/unlock`,
                body: JSON.stringify({
                    clientEventId: crypto.randomUUID(),
                    data: {
                        roomItemId,
                        lockToken: ownedLock.lockToken,
                        reason,
                    },
                }),
            });
            return true;
        },
        [roomId],
    );

    const moveItem = useCallback(
        ({ roomItemId, targetTierId, newIndex }) => {
            const client = clientRef.current;
            const itemKey = String(roomItemId);
            const ownedLock = ownedLockTokensRef.current.get(itemKey);

            if (!client?.connected || !ownedLock) {
                setConnectionError("아이템 잠금 후 다시 시도해 주세요.");
                return null;
            }

            const clientEventId = crypto.randomUUID();
            setConnectionError("");
            ownedLock.moveClientEventId = clientEventId;
            client.publish({
                destination: `/app/rooms/${roomId}/items/move`,
                body: JSON.stringify({
                    clientEventId,
                    baseVersion: versionRef.current,
                    data: {
                        roomItemId,
                        targetTierId,
                        newIndex,
                        lockToken: ownedLock.lockToken,
                    },
                }),
            });
            return clientEventId;
        },
        [roomId],
    );

    const renameTier = useCallback(
        ({ tierId, name }) =>
            publishCommand("tiers/rename", {
                tierId,
                name,
            }),
        [publishCommand],
    );

    const updateFittingCandidate = useCallback(
        ({ roomItemId, selected }) =>
            publishCommand("fitting-candidates/update", {
                roomItemId,
                selected,
            }),
        [publishCommand],
    );

    const updateFittingDraft = useCallback(
        ({ sizeSelections, wearOptions, prompt }) => {
            const client = clientRef.current;

            if (!client?.connected) {
                setConnectionError("방 연결 후 다시 시도해 주세요.");
                return null;
            }

            const clientEventId = crypto.randomUUID();
            const baseDraftRevision = draftRevisionRef.current;
            draftRevisionRef.current = baseDraftRevision + 1;
            client.publish({
                destination: `/app/rooms/${roomId}/fitting-draft/update`,
                body: JSON.stringify({
                    clientEventId,
                    baseVersion: versionRef.current,
                    baseDraftRevision,
                    data: {
                        sizeSelections: Array.isArray(sizeSelections)
                            ? sizeSelections
                            : [],
                        wearOptions: {
                            topTuck: wearOptions?.topTuck ?? null,
                            outerClosure: wearOptions?.outerClosure ?? null,
                            sleeves: wearOptions?.sleeves ?? null,
                        },
                        prompt: prompt ?? "",
                    },
                }),
            });
            return clientEventId;
        },
        [roomId],
    );

    const publishPendingCursor = useCallback(() => {
        cursorPublishTimerRef.current = null;

        const client = clientRef.current;
        const cursor = pendingCursorRef.current;

        if (!client?.connected || !cursor) {
            pendingCursorRef.current = null;
            return false;
        }

        pendingCursorRef.current = null;
        lastCursorPublishAtRef.current = performance.now();
        client.publish({
            destination: `/app/rooms/${roomId}/cursor`,
            body: JSON.stringify(cursor),
        });
        return true;
    }, [roomId]);

    const moveCursor = useCallback(
        ({ x, y }) => {
            const client = clientRef.current;
            const now = performance.now();
            const participantId = roomSession?.participantId;

            if (!client?.connected || participantId == null || !Number.isFinite(x) || !Number.isFinite(y)) {
                return false;
            }

            const normalizedCursor = {
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y)),
            };

            setCursors((currentCursors) => ({
                ...currentCursors,
                [String(participantId)]: {
                    participantId,
                    ...normalizedCursor,
                    updatedAt: Date.now(),
                },
            }));

            pendingCursorRef.current = normalizedCursor;

            const elapsed = now - lastCursorPublishAtRef.current;

            if (elapsed >= CURSOR_PUBLISH_INTERVAL_MS) {
                if (cursorPublishTimerRef.current !== null) {
                    window.clearTimeout(cursorPublishTimerRef.current);
                    cursorPublishTimerRef.current = null;
                }

                return publishPendingCursor();
            }

            if (cursorPublishTimerRef.current === null) {
                cursorPublishTimerRef.current = window.setTimeout(publishPendingCursor, CURSOR_PUBLISH_INTERVAL_MS - elapsed);
            }

            return true;
        },
        [publishPendingCursor, roomSession?.participantId],
    );

    const hideCursor = useCallback(() => {
        const participantId = roomSession?.participantId;

        if (participantId == null) return;

        const participantKey = String(participantId);

        setCursors((currentCursors) => {
            if (!currentCursors[participantKey]) return currentCursors;

            const nextCursors = { ...currentCursors };
            delete nextCursors[participantKey];
            return nextCursors;
        });
    }, [roomSession?.participantId]);

    const shareDemoPlacements = useCallback(
        (placements) => {
            const client = clientRef.current;

            if (!Array.isArray(placements)) {
                return false;
            }

            setSharedDemoPlacements(placements);

            if (!client?.connected) {
                return false;
            }

            client.publish({
                destination: `${ROOM_TOPIC_PREFIX}/${roomId}/demo-placements`,
                body: JSON.stringify({
                    senderParticipantId: roomSession?.participantId,
                    placements,
                }),
            });
            return true;
        },
        [roomId, roomSession?.participantId],
    );

    return {
        ...roomState,
        cursors,
        sharedDemoPlacements,
        connectionState,
        connectionError,
        startRoom,
        lockItem,
        unlockItem,
        moveItem,
        renameTier,
        updateFittingCandidate,
        updateFittingDraft,
        requestSync,
        applyRoomStatus,
        moveCursor,
        hideCursor,
        shareDemoPlacements,
    };
}
