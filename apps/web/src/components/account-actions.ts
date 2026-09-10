"use server";

import { apiFetch } from "@/lib/api";

export type ChangePasswordState = { error: string | null; success: boolean };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");
  if (
    typeof currentPassword !== "string" ||
    !currentPassword ||
    typeof newPassword !== "string" ||
    !newPassword ||
    typeof confirmPassword !== "string" ||
    !confirmPassword
  ) {
    return { error: "Preencha todos os campos.", success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: "As senhas não coincidem.", success: false };
  }
  if (newPassword.length < 8) {
    return { error: "A nova senha precisa ter pelo menos 8 caracteres.", success: false };
  }

  const res = await apiFetch("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    return { error: data?.message ?? "Não foi possível alterar a senha.", success: false };
  }

  return { error: null, success: true };
}
