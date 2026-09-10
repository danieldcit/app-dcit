"use client";

import { useNotificationContext } from "@/components/notification-context";
import styles from "./notificacoes.module.css";

export function NotificationHistoryHeader() {
  const { unreadCount, handleMarkAllRead } = useNotificationContext();
  if (unreadCount === 0) return null;
  return (
    <button type="button" className={styles.markAllRead} onClick={handleMarkAllRead}>
      Marcar todas como lidas
    </button>
  );
}
