import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";

const PARTICIPANT_TOPIC_PREFIX = "/topic/v1/rooms";

// - 인자: 서버 응답의 WebSocket 전체 주소 또는 경로
// - 동작: 현재 API 서버 기준의 ws 또는 wss 접속 주소 생성
function createWebSocketUrl(webSocketPath) {
    if (/^wss?:\/\//.test(webSocketPath)) {
        return webSocketPath;
    }

    const apiUrl = new URL(import.meta.env.VITE_API_BASE_URL ?? "http://localhost/api", window.location.origin);
    const webSocketUrl = new URL(webSocketPath, apiUrl.origin);
    webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";
    return webSocketUrl.toString();
}

// - 인자: 참여자 식별정보와 역할을 포함한 방 세션
// - 동작: 방 페이지에 먼저 표시할 현재 사용자 정보 생성
function getInitialParticipant(roomSession) {
    return {
        participantId: roomSession.participantId,
        nickname: roomSession.nickname ?? (roomSession.role === "HOST" ? "방장" : "참여자"),
        role: roomSession.role,
    };
}

// - 인자: 현재 참여자 목록과 STOMP로 수신한 참여자 이벤트
// - 동작: 전체 목록, 입장, 퇴장 이벤트에 맞춰 새 참여자 목록 반환
function updateParticipants(currentParticipants, event) {
    const eventType = event.type ?? event.eventType;
    const payload = event.data ?? event.payload ?? event;

    if (eventType === "PARTICIPANTS_SNAPSHOT" || Array.isArray(payload.participants)) {
        return payload.participants;
    }

    if (eventType === "PARTICIPANT_JOINED" || eventType === "PARTICIPANT_JOIN") {
        const participant = payload.participant ?? payload;
        return [...currentParticipants.filter((current) => current.participantId !== participant.participantId), participant];
    }

    if (eventType === "PARTICIPANT_LEFT" || eventType === "PARTICIPANT_LEAVE") {
        const participantId = payload.participantId ?? payload.participant?.participantId;
        return currentParticipants.filter((participant) => participant.participantId !== participantId);
    }

    return currentParticipants;
}

// - 인자: roomId와 roomToken 등을 포함한 방 세션
// - 동작: STOMP 연결 및 구독을 관리하고 참여자 목록과 연결 상태 반환
export function useRoomParticipants(roomSession) {
    const [participants, setParticipants] = useState(() => (roomSession ? [getInitialParticipant(roomSession)] : []));
    const [connectionState, setConnectionState] = useState(() => (roomSession?.roomToken && roomSession?.roomId ? "CONNECTING" : "DISCONNECTED"));
    const [connectionError, setConnectionError] = useState("");

    useEffect(() => {
        if (!roomSession?.roomToken || !roomSession?.roomId) {
            return undefined;
        }

        // 참여자 이벤트 구독 및 연결 생명주기 관리
        const client = new Client({
            brokerURL: createWebSocketUrl("/ws/v1"),
            connectHeaders: {
                Authorization: `Bearer ${roomSession.roomToken}`,
            },
            heartbeatIncoming: 10_000,
            heartbeatOutgoing: 10_000,
            reconnectDelay: 5_000,
            onConnect: () => {
                setConnectionState("CONNECTED");
                setConnectionError("");

                client.subscribe(`${PARTICIPANT_TOPIC_PREFIX}/${roomSession.roomId}/participants`, (message) => {
                    try {
                        const event = JSON.parse(message.body);
                        setParticipants((current) => updateParticipants(current, event));
                    } catch {
                        setConnectionError("참여자 이벤트를 해석하지 못했습니다.");
                    }
                });
            },
            onStompError: (frame) => {
                setConnectionState("ERROR");
                setConnectionError(frame.headers.message ?? "WebSocket 연결에 실패했습니다.");
            },
            onWebSocketError: () => {
                setConnectionState("ERROR");
                setConnectionError("WebSocket 연결에 실패했습니다.");
            },
            onWebSocketClose: () => {
                setConnectionState("DISCONNECTED");
            },
        });

        client.activate();

        return () => {
            client.deactivate();
        };
    }, [roomSession]);

    return {
        participants,
        connectionState,
        connectionError,
    };
}
