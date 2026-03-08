import { NextResponse } from "next/server";

import { fetchBackend, relayResponse, resolveActor } from "@/lib/server-api";

export async function GET(request: Request): Promise<Response> {
  const actor = await resolveActor();

  if (actor.isGuest) {
    return NextResponse.json(
      { error: "Sign in to access the dashboard." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const backendResponse = await fetchBackend(
    `/api/v1/trips${limit ? `?limit=${encodeURIComponent(limit)}` : ""}`,
    { method: "GET" },
    actor.userId,
  );

  return relayResponse(backendResponse, actor);
}

export async function POST(request: Request): Promise<Response> {
  const actor = await resolveActor();

  const incoming = await request.formData();
  const formData = new FormData();
  for (const [key, value] of incoming.entries()) {
    if (key === "user_id") {
      continue;
    }
    formData.append(key, value);
  }

  const backendResponse = await fetchBackend(
    "/api/v1/trips",
    {
      method: "POST",
      body: formData,
    },
    actor.userId,
  );

  return relayResponse(backendResponse, actor);
}
