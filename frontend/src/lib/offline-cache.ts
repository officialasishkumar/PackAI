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

  window.localStorage.setItem(cacheKey(trip._id), JSON.stringify(trip));
  persistIndex(trip);
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

function persistIndex(trip: Trip): void {
  const nextUpdatedAt = trip.updated_at ?? trip.created_at ?? new Date().toISOString();
  const nextIndex = readIndex()
    .filter((entry) => entry.id !== trip._id)
    .concat({ id: trip._id, updatedAt: nextUpdatedAt })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const retained = nextIndex.slice(0, MAX_CACHED_TRIPS);
  for (const staleEntry of nextIndex.slice(MAX_CACHED_TRIPS)) {
    window.localStorage.removeItem(cacheKey(staleEntry.id));
  }

  window.localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(retained));
}

function readIndex(): CacheIndexEntry[] {
  const raw = window.localStorage.getItem(CACHE_INDEX_KEY);
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
