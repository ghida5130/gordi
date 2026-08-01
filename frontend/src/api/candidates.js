import { authApi } from "@/api/request";

export function getCandidates(roomId) {
  return authApi.get("v1/candidates", {
    params: {
      roomId,
    },
  });
}
