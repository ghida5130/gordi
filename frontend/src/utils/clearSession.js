import { queryClient } from "@/lib/queryClient";
import { useUserStore } from "@/stores/useUserStore";
import { removeBodyInformation } from "@/utils/bodyInformationStorage";
import { removeRoomSession } from "@/utils/roomSessionStorage";
import { removeAccessToken } from "@/utils/tokenStorage";

export function clearSession() {
  queryClient.clear();
  removeAccessToken();
  removeBodyInformation();
  removeRoomSession();
  useUserStore.getState().clearUser();
}
