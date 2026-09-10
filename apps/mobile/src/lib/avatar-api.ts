import { API_URL } from "@/constants/api";

async function authedFetch(token: string, path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function fetchMyAvatar(token: string): Promise<string | null> {
  try {
    const response = await authedFetch(token, "/employees/me/avatar");
    if (!response.ok) return null;
    const data = (await response.json()) as { photo: string | null };
    return data.photo;
  } catch {
    return null;
  }
}

export async function updateMyAvatar(token: string, photo: string): Promise<boolean> {
  try {
    const response = await authedFetch(token, "/employees/me/avatar", {
      method: "POST",
      body: JSON.stringify({ photo }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function removeMyAvatar(token: string): Promise<boolean> {
  try {
    const response = await authedFetch(token, "/employees/me/avatar", { method: "DELETE" });
    return response.ok;
  } catch {
    return false;
  }
}
