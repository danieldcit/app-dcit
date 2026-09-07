import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { apiFetchJson } from "@/lib/api";
import { requireSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  // Both independent of each other — run concurrently rather than paying
  // two round trips in sequence on every page load.
  // Best-effort: a notifications failure can't take down the layout every
  // page in the portal renders through — worst case the bell opens empty
  // until the next successful navigation refetches it.
  const notificationsPromise = apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(
    () => [] as NotificationRecord[],
  );
  // proxy.ts already redirects a restricted colaborador to /onboarding for
  // every other route — this second check (same endpoint) only decides what
  // the sidebar itself renders on the page the proxy just let through. Only
  // fetched for colaborador — gestor/rh are never restricted, so skip the
  // network call entirely for them rather than resolving it and discarding.
  const unlockedPromise =
    user.role === "colaborador"
      ? apiFetchJson<{ unlocked: boolean }>("/onboarding/meu-status").catch(() => ({ unlocked: true }))
      : Promise.resolve({ unlocked: true });

  const [notifications, { unlocked }] = await Promise.all([notificationsPromise, unlockedPromise]);
  const restricted = user.role === "colaborador" && !unlocked;
  return (
    <AppShell user={user} notifications={notifications} restricted={restricted}>
      {children}
    </AppShell>
  );
}
