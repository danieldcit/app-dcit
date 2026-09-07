import type { ReactNode } from "react";

import type { Session } from "@/lib/session";
import { logout } from "@/lib/session";

import { NotificationBell } from "./notification-bell";
import { NotificationProvider } from "./notification-context";
import type { NotificationRecord } from "./notification-list";
import { SearchOverlay } from "./search-overlay";
import { SidebarShell } from "./sidebar-shell";
import { ThemeToggle } from "./theme-toggle";
import styles from "./app-shell.module.css";

const ROLE_LABELS: Record<Session["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

export function AppShell({
  children,
  user,
  notifications,
  restricted,
}: {
  children: ReactNode;
  user: Session;
  notifications: NotificationRecord[];
  restricted?: boolean;
}) {
  return (
    <NotificationProvider notifications={notifications}>
      <div className={styles.shell}>
        <SidebarShell role={user.role} restricted={restricted} />
        <div className={styles.main}>
          <header className={styles.topbar}>
            <SearchOverlay role={user.role} />
            <div className={styles.topbarActions}>
              <ThemeToggle />
              <NotificationBell />
              <details className={styles.userMenu}>
                <summary className={styles.userMenuButton} aria-label="Menu do usuário">
                  <svg
                    className={styles.userIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path
                      d="M4 20c0-4.418 3.582-7 8-7s8 2.582 8 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </summary>
                <div className={styles.userMenuPanel}>
                  <div className={styles.userMenuIdentity}>
                    <span className={styles.identityName}>{user.name}</span>
                    <span className={styles.identityRole}>{ROLE_LABELS[user.role]}</span>
                  </div>
                  <form action={logout} className={styles.userMenuLogoutForm}>
                    <button type="submit" className={styles.userMenuLogout}>
                      Sair
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </header>
          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </NotificationProvider>
  );
}
