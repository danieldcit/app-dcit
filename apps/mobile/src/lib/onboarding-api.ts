import { ONBOARDING_ACCESS_ITEMS, ONBOARDING_ACCESS_ITEM_LABELS } from "@ponto-dcit/shared-types";

import { API_URL } from "@/constants/api";

export { ONBOARDING_ACCESS_ITEMS, ONBOARDING_ACCESS_ITEM_LABELS };

export type OnboardingTaskRecord = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  requiresUpload: boolean;
  requiresVideo: boolean;
  showsTeam: boolean;
  requiresContract: boolean;
  requiresAccessChecklist: boolean;
};

export type OnboardingTasksResponse = {
  tasks: OnboardingTaskRecord[];
  completedTaskIds: string[];
  completedAccessItems: string[];
  fullAccessGrantedAt: string | null;
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
    return isOnboardingTasksResponse(data) ? (data as OnboardingTasksResponse) : null;
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

export async function fetchOnboardingStatus(token: string): Promise<{ unlocked: boolean } | null> {
  try {
    const response = await authedFetch(token, "/onboarding/meu-status");
    if (!response.ok) return null;
    return (await response.json()) as { unlocked: boolean };
  } catch {
    return null;
  }
}

export async function toggleOnboardingAccessItem(
  token: string,
  item: string,
): Promise<{ completed: boolean } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/acessos/${item}/toggle`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as { completed: boolean };
  } catch {
    return null;
  }
}

export type TeamOnboardingProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: OnboardingTaskRecord[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};

export async function fetchTeamOnboardingProgress(
  token: string,
): Promise<TeamOnboardingProgress[] | null> {
  try {
    const response = await authedFetch(token, "/onboarding/equipe");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as TeamOnboardingProgress[]) : null;
  } catch {
    return null;
  }
}

export async function grantOnboardingFullAccess(
  token: string,
  userId: string,
): Promise<{ grantedAt: string; source: string; grantedByName: string | null } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/equipe/${userId}/liberar-acesso`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as { grantedAt: string; source: string; grantedByName: string | null };
  } catch {
    return null;
  }
}
