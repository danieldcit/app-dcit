"use server";

import { apiFetch } from "@/lib/api";

export async function getMyAvatar(): Promise<string | null> {
  const res = await apiFetch("/employees/me/avatar");
  if (!res.ok) {
    throw new Error(`/employees/me/avatar responded with ${res.status}`);
  }
  const data = (await res.json()) as { photo: string | null };
  return data.photo;
}

export async function updateMyAvatar(photo: string): Promise<void> {
  const res = await apiFetch("/employees/me/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo }),
  });
  if (!res.ok) {
    throw new Error(`/employees/me/avatar responded with ${res.status}`);
  }
}

export async function removeMyAvatar(): Promise<void> {
  const res = await apiFetch("/employees/me/avatar", { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/employees/me/avatar responded with ${res.status}`);
  }
}
