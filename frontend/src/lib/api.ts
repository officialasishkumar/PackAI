import { Trip, TripItem, TripStatus } from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

export class APIError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.payload = payload;
  }
}

interface UpdateItemsPayload {
  items: TripItem[];
  status: TripStatus;
}

export async function createTrip(input: {
  tripName: string;
  media: File;
  userId?: string;
}): Promise<Trip> {
  const formData = new FormData();
  formData.set("trip_name", input.tripName);
  formData.set("media", input.media);
  if (input.userId) {
    formData.set("user_id", input.userId);
  }

  return apiRequest<Trip>("/api/v1/trips", {
    method: "POST",
    body: formData,
  });
}

export async function getTrip(id: string): Promise<Trip> {
  return apiRequest<Trip>(`/api/v1/trips/${id}`, {
    method: "GET",
    cache: "no-store",
  });
}

export async function updateTripItems(
  id: string,
  payload: UpdateItemsPayload,
): Promise<Trip> {
  return apiRequest<Trip>(`/api/v1/trips/${id}/items`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected request failure.";
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new APIError(response.status, extractMessage(payload), payload);
  }

  return payload as T;
}

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function extractMessage(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return "Request failed.";
}
