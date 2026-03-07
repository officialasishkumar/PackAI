const DEVICE_ID_KEY = "packai.device-id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-render";
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const nextValue =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `packai-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;

  window.localStorage.setItem(DEVICE_ID_KEY, nextValue);
  return nextValue;
}
