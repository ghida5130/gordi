import { authApi } from "@/api/request";

export function getMyInfo() {
    return authApi.get("/v1/users/me");
}

export function getMyActiveRoom() {
    return authApi.get("/v1/users/me/active-room");
}

export function getMyAvatar() {
    return authApi.get("/v1/users/me/avatar");
}

export function updateMyAvatar({ avatarId }) {
    return authApi.put("/v1/users/me/avatar", { avatarId });
}

export function updateNickname({ nickname }) {
    return authApi.patch("/v1/users/me", { nickname });
}

export function getMyResults() {
    return authApi.get("/v1/users/me/results");
}
