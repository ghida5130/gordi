const ROOM_SESSION_KEY = "roomSession";

export function getRoomSession() {
  const storedSession = sessionStorage.getItem(ROOM_SESSION_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession);
  } catch {
    sessionStorage.removeItem(ROOM_SESSION_KEY);
    return null;
  }
}

export function setRoomSession(roomSession) {
  sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(roomSession));
}

export function removeRoomSession() {
  sessionStorage.removeItem(ROOM_SESSION_KEY);
}
