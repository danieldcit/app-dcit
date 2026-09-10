import type { ReactNode } from "react";

import type { Session } from "@/lib/session";
import { logout } from "@/lib/session";

import { NotificationBell } from "./notification-bell";
import { NotificationProvider } from "./notification-context";
import type { NotificationRecord } from "./notification-list";
import { SearchOverlay } from "./search-overlay";
import { SidebarShell } from "./sidebar-shell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import styles from "./app-shell.module.css";

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
              <UserMenu user={user} logout={logout} />
            </div>
          </header>
          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </NotificationProvider>
  );
}
