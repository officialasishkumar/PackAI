import { fetchBackend, relayResponse, resolveActor } from "@/lib/server-api";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await resolveActor();

  const { id } = await context.params;
  const backendResponse = await fetchBackend(
    `/api/v1/trips/${id}/items`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: await request.text(),
    },
    actor.userId,
  );

  return relayResponse(backendResponse, actor);
}
