import { NotificationHistoryHeader } from "./notification-history-header";
import { NotificationHistoryList } from "./notification-history-list";
import styles from "./notificacoes.module.css";

export default function NotificacoesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Notificações</h1>
        <NotificationHistoryHeader />
      </div>
      <NotificationHistoryList />
    </div>
  );
}
