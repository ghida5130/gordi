import { publicApi } from "@/api/request";

export function getCandidates({ roomId, roomToken }) {
  return publicApi.get("v1/candidates", {
    params: {
      roomId,
    },
    headers: {
      Authorization: `Bearer ${roomToken}`,
    },
  });
}
