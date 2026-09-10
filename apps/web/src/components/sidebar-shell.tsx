"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import type { NavRole } from "@/lib/nav-sections";

import { useLocale } from "./locale-context";
import { NavLinks } from "./nav-links";
import styles from "./app-shell.module.css";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export function SidebarShell({ role, restricted }: { role: NavRole; restricted?: boolean }) {
  // Always starts expanded, matching SSR — same reasoning as ThemeToggle:
  // reading localStorage during the initial render would risk a
  // client-vs-server mismatch. Synced from the real stored value right
  // after mount instead.
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return (
    <aside className={collapsed ? `${styles.sidebar} ${styles.sidebarCollapsed}` : styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <Image
            src="/sgp-icon.png"
            alt="SGP"
            width={1265}
            height={1243}
            className={styles.brandIconImage}
            priority
          />
        </div>
        {collapsed ? null : (
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>SGP</span>
            <span className={styles.brandSubtitle}>{t("Sistema de Gestão de Pessoas")}</span>
          </div>
        )}
        <button
          type="button"
          className={styles.brandChevronButton}
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("Expandir menu") : t("Recolher menu")}
          title={collapsed ? t("Expandir menu") : t("Recolher menu")}
        >
          <svg
            className={collapsed ? `${styles.brandChevron} ${styles.brandChevronCollapsed}` : styles.brandChevron}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <NavLinks role={role} collapsed={collapsed} restricted={restricted} />
    </aside>
  );
}
