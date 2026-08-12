import { publicApi, withRoomToken } from "@/api/request";

export function getCandidates({ roomToken, roomId }) {
  return publicApi.get(
    "v1/candidates",
    withRoomToken(roomToken, { params: { roomId } }),
  );
}

export function addCandidate({ roomToken, roomId, productId }) {
  return publicApi.post(
    "v1/candidates",
    { roomId, productId },
    withRoomToken(roomToken),
  );
}

export function deleteCandidate({ roomToken, roomId, productId }) {
  return publicApi.delete(
    `v1/candidates/${encodeURIComponent(productId)}`,
    withRoomToken(roomToken, { params: { roomId } }),
  );
}
