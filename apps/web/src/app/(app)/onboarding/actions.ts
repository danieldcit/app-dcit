"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function toggleOnboardingTask(taskId: string): Promise<{ completed: boolean }> {
  const res = await apiFetch(`/onboarding/tarefas/${taskId}/toggle`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/onboarding/tarefas/${taskId}/toggle responded with ${res.status}`);
  }
  const data = (await res.json()) as { completed: boolean };
  revalidatePath("/onboarding");
  return data;
}

export async function toggleOnboardingAccessItem(item: string): Promise<{ completed: boolean }> {
  const res = await apiFetch(`/onboarding/acessos/${item}/toggle`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/onboarding/acessos/${item}/toggle responded with ${res.status}`);
  }
  const data = (await res.json()) as { completed: boolean };
  revalidatePath("/onboarding");
  return data;
}

export async function grantOnboardingFullAccess(userId: string): Promise<{ grantedAt: string }> {
  const res = await apiFetch(`/onboarding/equipe/${userId}/liberar-acesso`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/onboarding/equipe/${userId}/liberar-acesso responded with ${res.status}`);
  }
  const data = (await res.json()) as { grantedAt: string };
  revalidatePath("/onboarding");
  return data;
}
