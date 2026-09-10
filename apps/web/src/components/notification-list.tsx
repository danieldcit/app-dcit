"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useLocale } from "./locale-context";
import { markAllNotificationsRead, markNotificationRead } from "./notification-actions";
import styles from "./notification-list.module.css";

export type NotificationRecord = {
  id: string;
  type: string;
  category: string | null;
  message: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

function formatNotificationDate(iso: string): string {
  // createdAt is a full ISO instant (Prisma DateTime -> JSON), not a
  // date-only value — unlike the formatDateOnly convention used elsewhere
  // (which pins UTC to avoid shifting a date-only field by a day), a
  // notification's real wall-clock time in São Paulo is what matters here.
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Shared state + click behavior between the bell's dropdown (truncated
// list) and /notificacoes (full list) — each call site owns its own copy
// of local state, updated optimistically.
export function useNotificationInbox(initial: NotificationRecord[]) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const unreadCount = items.filter((n) => n.readAt === null).length;

  function handleClick(notification: NotificationRecord) {
    if (notification.readAt === null) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((n) => (n.id === notification.id ? { ...n, readAt } : n)));
      startTransition(() => {
        // Best-effort: marking read is a side effect of the click, not the
        // user's primary intent — a failure here never blocks navigation
        // or shows an error. Worst case the notification reads unread
        // again next time /notifications/mine is refetched.
        markNotificationRead(notification.id).catch(() => {});
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  function handleMarkAllRead() {
    const readAt = new Date().toISOString();
    setItems((current) => current.map((n) => (n.readAt === null ? { ...n, readAt } : n)));
    startTransition(() => {
      // Same best-effort contract as handleClick above.
      markAllNotificationsRead().catch(() => {});
    });
  }

  return { items, unreadCount, handleClick, handleMarkAllRead };
}

export function NotificationList({
  notifications,
  onItemClick,
}: {
  notifications: NotificationRecord[];
  onItemClick: (notification: NotificationRecord) => void;
}) {
  const { t } = useLocale();
  if (notifications.length === 0) {
    return <p className={styles.empty}>{t("Nenhuma notificação.")}</p>;
  }
  return (
    <ul className={styles.list}>
      {notifications.map((notification) => (
        <li key={notification.id}>
          <button
            type="button"
            className={
              notification.readAt === null ? `${styles.item} ${styles.itemUnread}` : styles.item
            }
            onClick={() => onItemClick(notification)}
          >
            <span className={styles.message}>{notification.message}</span>
            <span className={styles.date}>{formatNotificationDate(notification.createdAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
