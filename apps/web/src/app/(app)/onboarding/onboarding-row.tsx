"use client";

import { useRef, useState } from "react";

import { grantOnboardingFullAccess } from "./actions";
import styles from "./onboarding.module.css";

type Task = {
  id: string;
  title: string;
  description: string;
};

type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};

function grantLabel(entry: TeamProgress): string {
  if (!entry.fullAccessGrantedAt) return "Liberar acesso total ao SGP Portal";
  if (entry.fullAccessGrantSource === "manual") {
    return `Liberado manualmente por ${entry.fullAccessGrantedByName}`;
  }
  return "Acesso liberado automaticamente";
}

export function OnboardingRow({ entry }: { entry: TeamProgress }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const [granting, setGranting] = useState(false);
  const percent =
    entry.totalCount === 0 ? 0 : Math.round((entry.completedCount / entry.totalCount) * 100);
  const complete = entry.totalCount > 0 && entry.completedCount === entry.totalCount;
  const completedSet = new Set(entry.completedTaskIds);

  async function handleGrantFullAccess() {
    setGranting(true);
    try {
      await grantOnboardingFullAccess(entry.userId);
    } finally {
      setGranting(false);
      confirmDialogRef.current?.close();
    }
  }

  return (
    <>
      <li className={styles.item}>
        <button
          type="button"
          className={styles.itemButton}
          onClick={() => dialogRef.current?.showModal()}
        >
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>{entry.userName}</span>
            <span className={styles.itemDetail}>
              {entry.completedCount} de {entry.totalCount} tarefas concluídas
            </span>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${percent}%` }} />
            </div>
          </div>
          <span className={complete ? styles.statusComplete : styles.statusPending}>
            {complete ? "Concluído" : `${percent}%`}
          </span>
        </button>
      </li>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Tarefas de {entry.userName}</p>
        <ul className={styles.taskList}>
          {entry.tasks.map((task) => {
            const done = completedSet.has(task.id);
            return (
              <li key={task.id} className={styles.taskItem}>
                <span className={done ? styles.taskDone : styles.taskPending}>
                  {done ? "Concluída" : "Pendente"}
                </span>
                <div className={styles.taskInfo}>
                  <span className={styles.taskTitle}>{task.title}</span>
                  <span className={styles.taskDescription}>{task.description}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={styles.grantAccessButton}
          disabled={granting || Boolean(entry.fullAccessGrantedAt)}
          onClick={() => confirmDialogRef.current?.showModal()}
        >
          {grantLabel(entry)}
        </button>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={() => dialogRef.current?.close()}
          >
            Fechar
          </button>
        </div>
      </dialog>

      <dialog ref={confirmDialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Liberar acesso total ao SGP Portal para {entry.userName}?</p>
        <p className={styles.itemDetail}>
          {complete
            ? `${entry.userName} concluiu todas as etapas do onboarding — essa ação libera o acesso completo ao portal.`
            : `${entry.userName} ainda não completou o onboarding (${entry.completedCount} de ${entry.totalCount}). Essa é uma exceção manual — o colaborador ganha acesso completo ao portal mesmo assim.`}
        </p>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={() => confirmDialogRef.current?.close()}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.grantAccessButton}
            disabled={granting}
            onClick={handleGrantFullAccess}
          >
            Confirmar liberação
          </button>
        </div>
      </dialog>
    </>
  );
}
