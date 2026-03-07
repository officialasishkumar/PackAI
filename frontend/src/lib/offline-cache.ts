import { Trip } from "@/lib/types";

const CACHE_PREFIX = "packai.trip.";
const CACHE_INDEX_KEY = "packai.trip.index";
const MAX_CACHED_TRIPS = 20;

interface CacheIndexEntry {
  id: string;
  updatedAt: string;
}

export function cacheTrip(trip: Trip): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(cacheKey(trip.user_id, trip._id), JSON.stringify(trip));
  persistIndex(trip);
}

export function getCachedTrip(id: string): Trip | null {
  if (typeof window === "undefined") {
    return null;
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey || !storageKey.startsWith(CACHE_PREFIX) || !storageKey.endsWith(`.${id}`)) {
      continue;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      continue;
    }

    try {
      return JSON.parse(raw) as Trip;
    } catch {
      return null;
    }
  }

  return null;
}

function cacheKey(userId: string, id: string): string {
  return `${CACHE_PREFIX}${userId}.${id}`;
}

function persistIndex(trip: Trip): void {
  const nextUpdatedAt = trip.updated_at ?? trip.created_at ?? new Date().toISOString();
  const nextIndex = readIndex(trip.user_id)
    .filter((entry) => entry.id !== trip._id)
    .concat({ id: trip._id, updatedAt: nextUpdatedAt })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const retained = nextIndex.slice(0, MAX_CACHED_TRIPS);
  for (const staleEntry of nextIndex.slice(MAX_CACHED_TRIPS)) {
    window.localStorage.removeItem(cacheKey(trip.user_id, staleEntry.id));
  }

  window.localStorage.setItem(indexKey(trip.user_id), JSON.stringify(retained));
}

function readIndex(userId: string): CacheIndexEntry[] {
  const raw = window.localStorage.getItem(indexKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CacheIndexEntry[];
    return parsed.filter(
      (entry) =>
        typeof entry?.id === "string" && typeof entry?.updatedAt === "string",
    );
  } catch {
    return [];
  }
}

function indexKey(userId: string): string {
  return `${CACHE_INDEX_KEY}.${userId}`;
}
