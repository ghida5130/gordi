import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

import { createVoiceToken } from "@/api/voice";
import { getApiErrorMessage } from "@/utils/apiError";

const initialConnectionState = "DISCONNECTED";

function removeAttachedAudio(elements) {
  elements.forEach((element) => {
    element.pause();
    element.remove();
  });
  elements.clear();
}

export function useVoiceChat({ roomCode, roomToken, enabled }) {
  const roomRef = useRef(null);
  const attachedAudioElementsRef = useRef(new Set());
  const speakerMutedRef = useRef(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [connectionState, setConnectionState] = useState(
    initialConnectionState,
  );
  const [connectionError, setConnectionError] = useState("");
  const [microphoneError, setMicrophoneError] = useState("");
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isMicControlPending, setIsMicControlPending] = useState(false);
  const [needsAudioStart, setNeedsAudioStart] = useState(false);

  useEffect(() => {
    if (!enabled || !roomCode || !roomToken) {
      return undefined;
    }

    let cancelled = false;
    let reconnectTimer;
    const attachedAudioElements = attachedAudioElementsRef.current;
    const room = new Room({
      disconnectOnPageLeave: true,
    });
    roomRef.current = room;

    const handleTrackSubscribed = (track) => {
      if (track.kind !== Track.Kind.Audio) return;

      const element = track.attach();
      element.autoplay = true;
      element.hidden = true;
      element.muted = speakerMutedRef.current;
      attachedAudioElements.add(element);
      document.body.appendChild(element);
    };
    const handleTrackUnsubscribed = (track) => {
      track.detach().forEach((element) => {
        attachedAudioElements.delete(element);
        element.remove();
      });
    };
    const syncAudioPlaybackState = () => {
      setNeedsAudioStart(!room.canPlaybackAudio);
    };
    const handleDisconnected = () => {
      removeAttachedAudio(attachedAudioElements);
      setIsMicMuted(true);

      if (cancelled) return;

      setConnectionState("RECONNECTING");
      reconnectTimer = window.setTimeout(() => {
        setConnectionAttempt((current) => current + 1);
      }, 1_500);
    };

    room
      .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .on(RoomEvent.AudioPlaybackStatusChanged, syncAudioPlaybackState)
      .on(RoomEvent.Reconnecting, () => setConnectionState("RECONNECTING"))
      .on(RoomEvent.Reconnected, () => setConnectionState("CONNECTED"))
      .on(RoomEvent.Disconnected, handleDisconnected);

    const connect = async () => {
      setConnectionState("CONNECTING");
      setConnectionError("");
      setMicrophoneError("");

      try {
        const response = await createVoiceToken({ roomCode, roomToken });
        const credentials = response?.data;

        if (!credentials?.serverUrl || !credentials?.participantToken) {
          throw new Error("음성 연결 정보가 올바르지 않습니다.");
        }

        await room.connect(
          credentials.serverUrl,
          credentials.participantToken,
        );

        if (cancelled) {
          room.disconnect();
          return;
        }

        setConnectionState("CONNECTED");
        syncAudioPlaybackState();

        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMicMuted(false);
        } catch {
          setIsMicMuted(true);
          setMicrophoneError(
            "마이크를 사용할 수 없습니다. 브라우저의 마이크 권한을 확인해 주세요.",
          );
        }
      } catch (error) {
        if (cancelled) return;

        setConnectionState("ERROR");
        setConnectionError(
          getApiErrorMessage(error, "음성 채팅에 연결하지 못했습니다."),
        );
      }
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      roomRef.current = null;
      room.disconnect();
      removeAttachedAudio(attachedAudioElements);
    };
  }, [connectionAttempt, enabled, roomCode, roomToken]);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;

    if (!room || connectionState !== "CONNECTED") return;

    const shouldEnable = isMicMuted;
    setIsMicControlPending(true);
    setMicrophoneError("");

    try {
      await room.localParticipant.setMicrophoneEnabled(shouldEnable);
      setIsMicMuted(!shouldEnable);
    } catch {
      setMicrophoneError(
        "마이크를 변경할 수 없습니다. 브라우저의 마이크 권한을 확인해 주세요.",
      );
    } finally {
      setIsMicControlPending(false);
    }
  }, [connectionState, isMicMuted]);

  const toggleSpeaker = useCallback(() => {
    if (connectionState !== "CONNECTED") return;

    setIsSpeakerMuted((current) => {
      const next = !current;
      speakerMutedRef.current = next;
      attachedAudioElementsRef.current.forEach((element) => {
        element.muted = next;
      });
      return next;
    });
  }, [connectionState]);

  const startAudio = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    try {
      await room.startAudio();
      setNeedsAudioStart(false);
    } catch {
      setConnectionError("음성 재생을 시작하지 못했습니다.");
    }
  }, []);

  const retryConnection = useCallback(() => {
    setConnectionAttempt((current) => current + 1);
  }, []);

  return {
    connectionState: enabled ? connectionState : initialConnectionState,
    connectionError,
    microphoneError,
    isMicMuted,
    isSpeakerMuted,
    isMicControlPending,
    needsAudioStart,
    toggleMicrophone,
    toggleSpeaker,
    startAudio,
    retryConnection,
  };
}
