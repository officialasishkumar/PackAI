const API_BASE_URL =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

export async function fetchBackend(
  path: string,
  init: RequestInit,
  userId: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-User-ID", userId);

  const internalToken = process.env.INTERNAL_API_TOKEN?.trim();
  if (internalToken) {
    headers.set("X-Internal-Token", internalToken);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
}

export async function relayResponse(response: Response): Promise<Response> {
  const body = await response.text();
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  return new Response(body, {
    status: response.status,
    headers,
  });
}
