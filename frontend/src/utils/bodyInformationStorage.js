const BODY_INFORMATION_KEY = "bodyInformation";

export function removeBodyInformation() {
    localStorage.removeItem(BODY_INFORMATION_KEY);
}
