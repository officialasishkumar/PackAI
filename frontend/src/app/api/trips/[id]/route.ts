import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { fetchBackend, relayResponse } from "@/lib/server-api";

function unauthorizedResponse(): Response {
  return Response.json({ error: "authentication is required" }, { status: 401 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const backendResponse = await fetchBackend(`/api/v1/trips/${id}`, { method: "GET" }, userId);
  return relayResponse(backendResponse);
}
