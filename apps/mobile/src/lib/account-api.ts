import { API_URL } from "@/constants/api";

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, message: data?.message ?? "Não foi possível alterar a senha." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível alterar a senha. Verifique sua conexão." };
  }
}
