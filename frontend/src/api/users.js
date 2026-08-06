import { authApi } from "@/api/request";

export function getMyInfo() {
    return authApi.get("/v1/users/me");
}

export function getMyActiveRoom() {
    return authApi.get("/v1/users/me/active-room");
}

export async function getMyAvatar() {
    const response = await authApi.get("/v1/users/me/avatar");
    const payload = response?.data ?? response;
    const avatar = payload?.avatar ?? payload;

    return {
        ...response,
        data: {
            ...avatar,
            height: payload?.height ?? avatar?.height ?? null,
            weight: payload?.weight ?? avatar?.weight ?? null,
        },
    };
}

export function updateMyAvatar({ avatarId, height, weight }) {
    return authApi.put("/v1/users/me/avatar", { avatarId, height, weight });
}

export function updateNickname({ nickname }) {
    return authApi.patch("/v1/users/me", { nickname });
}

export function getMyResults() {
    return authApi.get("/v1/users/me/results");
}
