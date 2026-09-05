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
