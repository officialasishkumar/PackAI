import { fetchBackend, relayResponse, resolveActor } from "@/lib/server-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await resolveActor();

  const { id } = await context.params;
  const backendResponse = await fetchBackend(
    `/api/v1/trips/${id}`,
    { method: "GET" },
    actor.userId,
  );
  return relayResponse(backendResponse, actor);
}
