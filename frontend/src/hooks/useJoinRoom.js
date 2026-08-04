import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { joinRoom } from "@/api/rooms";
import { setRoomSession } from "@/utils/roomSessionStorage";

export function useJoinRoom() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: joinRoom,
    onSuccess: (response, variables) => {
      // - 입장 응답과 입력 정보를 방 범위 세션으로 저장
      setRoomSession({
        ...response.data,
        roomCode: variables.roomCode.toUpperCase(),
        nickname: variables.nickname,
        maxParticipants: response.data.maxParticipants ?? 4,
        webSocketUrl: response.data.webSocketUrl ?? "/ws/v1",
      });
      navigate(`/rooms/${response.data.roomId}`);
    },
  });
}
