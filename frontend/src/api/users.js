import { authApi } from "@/api/request";

export function getMyInfo() {
  return authApi.get("/v1/users/me");
}

export function getMyAvatar() {
  return authApi.get("/v1/users/me/avatar");
}
