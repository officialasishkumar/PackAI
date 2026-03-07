export const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Toiletries",
  "Documents",
  "Misc",
] as const;

export type TripCategory = (typeof CATEGORIES)[number];
export type TripStatus = "packing" | "active_trip" | "repacking" | "completed";
export type WorkspaceMode = "packing" | "repacking";
export type ItemOrigin = "ai" | "manual";

export interface TripItem {
  item_id: string;
  name: string;
  category: TripCategory;
  quantity: number;
  is_packed_for_return: boolean;
  added_by: ItemOrigin;
}

export interface StoredMedia {
  storage_driver: string;
  location?: string;
  url?: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface TripLocation {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  captured_at?: string;
}

export interface Trip {
  _id: string;
  user_id: string;
  trip_name: string;
  created_at: string;
  updated_at?: string;
  status: TripStatus;
  items: TripItem[];
  location?: TripLocation;
  media?: StoredMedia;
}

export interface TripSummary {
  _id: string;
  trip_name: string;
  created_at: string;
  updated_at?: string;
  status: TripStatus;
  item_count: number;
  total_units: number;
  location?: TripLocation;
}

export function deriveWorkspaceMode(status?: TripStatus): WorkspaceMode {
  return status === "packing" ? "packing" : "repacking";
}

export function deriveTripStatus(
  mode: WorkspaceMode,
  items: TripItem[],
): TripStatus {
  if (items.length > 0 && items.every((item) => item.is_packed_for_return)) {
    return "completed";
  }

  if (mode === "repacking" || items.some((item) => item.is_packed_for_return)) {
    return "repacking";
  }

  return "packing";
}

export function countTotalUnits(items: TripItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function countPackedItems(items: TripItem[]): number {
  return items.filter((item) => item.is_packed_for_return).length;
}

export function formatTripLocation(location?: TripLocation): string {
  if (!location) {
    return "Location not shared";
  }

  return `Near ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
}
