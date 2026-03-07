import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";

const API_BASE_URL =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

const GUEST_COOKIE_NAME = "packai_guest_id";

export interface ActorContext {
  userId: string;
  isGuest: boolean;
  guestCookieToSet?: string;
}

export async function resolveActor(): Promise<ActorContext> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim();
  if (userId) {
    return {
      userId,
      isGuest: false,
    };
  }

  const cookieStore = await cookies();
  const existingGuestId = cookieStore.get(GUEST_COOKIE_NAME)?.value?.trim();
  if (existingGuestId) {
    return {
      userId: existingGuestId,
      isGuest: true,
    };
  }

  const guestId = `guest-${crypto.randomUUID()}`;
  return {
    userId: guestId,
    isGuest: true,
    guestCookieToSet: guestId,
  };
}

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

export async function relayResponse(
  response: Response,
  actor?: ActorContext,
): Promise<Response> {
  const body = await response.text();
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const nextResponse = new NextResponse(body, {
    status: response.status,
    headers,
  });

  if (actor?.guestCookieToSet) {
    nextResponse.cookies.set(GUEST_COOKIE_NAME, actor.guestCookieToSet, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return nextResponse;
}
