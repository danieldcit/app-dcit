import "server-only";

import { cookies } from "next/headers";

import { API_URL } from "@/constants/api";

import { SESSION_COOKIE } from "./session";

// Server-to-server call from the Next.js server to the API — the API's
// AuthGuard reads a Bearer token, not the cookie itself, so the raw JWT
// (the cookie's value) is forwarded as the Authorization header.
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token ?? ""}`,
    },
    cache: "no-store",
  });
}

export async function apiFetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    throw new Error(`${path} responded with ${res.status}`);
  }
  // Nest sends an empty body (not the text "null") when a controller
  // resolves null/undefined — e.g. GET /fiscal/parametros before any row
  // exists — so guard against that before calling res.json(), which throws
  // "Unexpected end of JSON input" on an empty string.
  const text = await res.text();
  return (text === "" ? null : JSON.parse(text)) as T;
}
