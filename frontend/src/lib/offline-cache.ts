import { Trip } from "@/lib/types";

const CACHE_PREFIX = "packai.trip.";

export function cacheTrip(trip: Trip): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(cacheKey(trip._id), JSON.stringify(trip));
}

export function getCachedTrip(id: string): Trip | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(cacheKey(id));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Trip;
  } catch {
    return null;
  }
}

function cacheKey(id: string): string {
  return `${CACHE_PREFIX}${id}`;
}

