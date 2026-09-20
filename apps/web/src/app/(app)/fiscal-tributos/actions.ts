"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function classifyTipoContratacao(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  const tipoContratacao = formData.get("tipoContratacao");
  if (typeof userId !== "string" || typeof tipoContratacao !== "string") {
    throw new Error("Invalid form data");
  }

  const res = await apiFetch(`/employees/${userId}/tipo-contratacao`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipoContratacao }),
  });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/tipo-contratacao responded with ${res.status}`);
  }

  revalidatePath("/fiscal-tributos");
}
