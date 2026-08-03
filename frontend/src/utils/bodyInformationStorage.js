const BODY_INFORMATION_KEY = "bodyInformation";

export function getBodyInformation() {
    const bodyInformation = localStorage.getItem(BODY_INFORMATION_KEY);

    if (!bodyInformation) return null;

    try {
        return JSON.parse(bodyInformation);
    } catch {
        localStorage.removeItem(BODY_INFORMATION_KEY);
        return null;
    }
}

export function setBodyInformation(bodyInformation) {
    localStorage.setItem(BODY_INFORMATION_KEY, JSON.stringify(bodyInformation));
}

export function removeBodyInformation() {
    localStorage.removeItem(BODY_INFORMATION_KEY);
}
