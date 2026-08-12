import { publicApi, withRoomToken } from "@/api/request";

export function createVoiceToken({ roomCode, roomToken }) {
  return publicApi.post(
    `v1/rooms/${encodeURIComponent(roomCode)}/voice/token`,
    {},
    withRoomToken(roomToken),
  );
}
