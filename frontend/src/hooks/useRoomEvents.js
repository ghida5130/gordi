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
        version: Number(roomSession?.version ?? 0),
        tiers: [],
        roomItems: [],
        placements: [],
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

function normalizeSnapshot(data) {
    const tiers = Array.isArray(data.tiers) ? data.tiers : [];
    const unclassifiedItems = Array.isArray(data.unclassifiedItems) ? data.unclassifiedItems : [];
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

    return {
        participants: Array.isArray(data.participants) ? data.participants : [],
        status: data.status ?? "WAITING",
        tiers: tiers.map(({ tierId, name, position }) => ({
            tierId,
            name,
            position,
        })),
        roomItems,
        placements,
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
            version: snapshotVersion,
            hasSnapshot: true,
            pendingEvents: [],
        };

        state.pendingEvents
            .filter((pendingEvent) => Number(pendingEvent.version ?? 0) >= snapshotVersion)
            .forEach((pendingEvent) => {
                nextState = roomEventReducer(nextState, pendingEvent);
            });

        return nextState;
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
    const lastCursorPublishAtRef = useRef(0);
    const pendingCursorRef = useRef(null);
    const cursorPublishTimerRef = useRef(null);
    const [roomState, dispatch] = useReducer(roomEventReducer, roomSession, createInitialState);
    const [cursors, setCursors] = useState({});
    const [sharedDemoPlacements, setSharedDemoPlacements] = useState(null);
    const [connectionState, setConnectionState] = useState(() => (roomSession?.roomToken && roomSession?.roomId ? "CONNECTING" : "DISCONNECTED"));
    const [connectionError, setConnectionError] = useState("");

    useEffect(() => {
        versionRef.current = roomState.version;
    }, [roomState.version]);

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

                dispatch(event);
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

        // - 방 이벤트와 커서, 개인 동기화 응답 구독 후 최신 상태 요청
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
                    id: "sub-room-sync",
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
                client.publish({
                    destination: `/app/rooms/${roomSession.roomId}/sync`,
                    body: JSON.stringify({
                        clientEventId: crypto.randomUUID(),
                    }),
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
                setConnectionState("DISCONNECTED");
            },
        });

        clientRef.current = client;
        client.activate();

        return () => {
            clientRef.current = null;
            ownedLockTokensRef.current.clear();
            lastCursorPublishAtRef.current = 0;
            pendingCursorRef.current = null;

            if (cursorPublishTimerRef.current !== null) {
                window.clearTimeout(cursorPublishTimerRef.current);
                cursorPublishTimerRef.current = null;
            }

            client.deactivate();
        };
    }, [roomSession]);

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

    const finishRoom = useCallback(() => publishCommand("finish", {}), [publishCommand]);

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

            if (!client?.connected || !Number.isFinite(x) || !Number.isFinite(y)) {
                return false;
            }

            pendingCursorRef.current = {
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y)),
            };

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
        [publishPendingCursor],
    );

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
        finishRoom,
        moveCursor,
        shareDemoPlacements,
    };
}
