import { API_URL } from "@/constants/api";

export type OnboardingTaskRecord = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  requiresUpload: boolean;
};

export type OnboardingTasksResponse = {
  tasks: OnboardingTaskRecord[];
  completedTaskIds: string[];
};

function isOnboardingTasksResponse(data: unknown): data is OnboardingTasksResponse {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return Array.isArray(candidate.tasks) && Array.isArray(candidate.completedTaskIds);
}

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

export async function fetchOnboardingTasks(token: string): Promise<OnboardingTasksResponse | null> {
  try {
    const response = await authedFetch(token, "/onboarding/tarefas");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isOnboardingTasksResponse(data) ? data : null;
  } catch {
    return null;
  }
}

export async function toggleOnboardingTask(
  token: string,
  taskId: string,
): Promise<{ completed: boolean } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/tarefas/${taskId}/toggle`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as { completed: boolean };
  } catch {
    return null;
  }
}
