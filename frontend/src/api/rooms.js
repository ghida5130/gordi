import { authApi, publicApi, withRoomToken } from "@/api/request";
import { getAccessToken } from "@/utils/tokenStorage";

export function createRoom(roomInformation, idempotencyKey) {
  return authApi.post("v1/rooms", roomInformation, {
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function joinRoom({ roomCode, nickname }) {
  const accessToken = getAccessToken();
  const api = accessToken ? authApi : publicApi;

  return api.post(
    `v1/rooms/${encodeURIComponent(roomCode)}/join`,
    { nickname },
  );
}

export function getRoomStatus({ roomCode, roomToken }) {
  return publicApi.get(
    `v1/rooms/${encodeURIComponent(roomCode)}`,
    withRoomToken(roomToken),
  );
}

export function getRoomResult({ roomCode, roomToken }) {
  const path = `v1/rooms/${encodeURIComponent(roomCode)}/result`;

  if (roomToken) {
    return publicApi.get(path, withRoomToken(roomToken));
  }

  return authApi.get(path);
}

export function finishRoom({ roomCode, roomToken, expectedVersion }) {
  return publicApi.post(
    `v1/rooms/${encodeURIComponent(roomCode)}/finish`,
    { expectedVersion },
    withRoomToken(roomToken),
  );
}
