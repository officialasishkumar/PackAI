import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { fetchBackend, relayResponse } from "@/lib/server-api";

function unauthorizedResponse(): Response {
  return Response.json({ error: "authentication is required" }, { status: 401 });
}

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const backendResponse = await fetchBackend(
    `/api/v1/trips${limit ? `?limit=${encodeURIComponent(limit)}` : ""}`,
    { method: "GET" },
    userId,
  );

  return relayResponse(backendResponse);
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return unauthorizedResponse();
  }

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
    userId,
  );

  return relayResponse(backendResponse);
}
