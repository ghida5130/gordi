import { authApi, publicApi } from "@/api/request";
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
  const config = accessToken
    ? {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    : {};

  return publicApi.post(
    `v1/rooms/${encodeURIComponent(roomCode)}/join`,
    { nickname },
    config,
  );
}

export function getRoomStatus({ roomCode, roomToken }) {
  return publicApi.get(`v1/rooms/${encodeURIComponent(roomCode)}`, {
    headers: {
      Authorization: `Bearer ${roomToken}`,
    },
  });
}

export function getRoomResult({ roomCode, roomToken }) {
  const path = `v1/rooms/${encodeURIComponent(roomCode)}/result`;

  if (roomToken) {
    return publicApi.get(path, {
      headers: {
        Authorization: `Bearer ${roomToken}`,
      },
    });
  }

  return authApi.get(path);
}

export function finishRoom({ roomCode, roomToken, expectedVersion }) {
  return publicApi.post(
    `v1/rooms/${encodeURIComponent(roomCode)}/finish`,
    { expectedVersion },
    {
      headers: {
        Authorization: `Bearer ${roomToken}`,
      },
    },
  );
}
