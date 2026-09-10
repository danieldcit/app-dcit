"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { useClickOutside } from "@/lib/use-click-outside";

import { useLocale } from "./locale-context";
import { useNotificationContext } from "./notification-context";
import { NotificationList } from "./notification-list";
import styles from "./notification-bell.module.css";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { items, unreadCount, handleClick, handleMarkAllRead } = useNotificationContext();
  const { t } = useLocale();

  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div className={styles.bell} ref={containerRef}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setOpen((current) => !current)}
        aria-label={t("Notificações")}
        aria-expanded={open}
      >
        <svg className={styles.bellIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t("Notificações")}</span>
            {unreadCount > 0 ? (
              <button type="button" className={styles.markAllRead} onClick={handleMarkAllRead}>
                {t("Marcar todas como lidas")}
              </button>
            ) : null}
          </div>
          <div className={styles.panelListScroll}>
            <NotificationList
              notifications={items.slice(0, 10)}
              onItemClick={(notification) => {
                handleClick(notification);
                setOpen(false);
              }}
            />
          </div>
          <Link href="/notificacoes" className={styles.viewAll} onClick={() => setOpen(false)}>
            {t("Ver todas")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
