"use client";

import { useState } from "react";

import { ADMISSION_DOCUMENT_KINDS, ADMISSION_DOCUMENT_KIND_LABELS } from "@ponto-dcit/shared-types";

import { AccessChecklistSection } from "./access-checklist-section";
import { AdmissionDocumentBox } from "../documentos/admission-document-box";
import { ContractBox } from "../documentos/contract-box";
import { toggleOnboardingAccessItem, toggleOnboardingTask } from "./actions";
import styles from "./onboarding.module.css";
import { TeamSection } from "./team-section";
import { WelcomeVideoPlayer } from "./welcome-video-player";

type Task = {
  id: string;
  title: string;
  description: string;
  requiresUpload: boolean;
  requiresVideo: boolean;
  showsTeam: boolean;
  requiresContract: boolean;
  requiresAccessChecklist: boolean;
};

type AdmissionDocumentRecord = {
  id: string;
  kind: string | null;
  title: string;
  status: "enviado" | "em_analise" | "aprovado" | "recusado";
  reviewNote: string | null;
  submittedAt: string;
};

export function ColaboradorOnboarding({
  tasks,
  completedTaskIds,
  admissionDocuments,
  signedContract,
  completedAccessItems,
}: {
  tasks: Task[];
  completedTaskIds: string[];
  admissionDocuments: AdmissionDocumentRecord[];
  signedContract: { submittedAt: string | null };
  completedAccessItems: string[];
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAccessItem, setPendingAccessItem] = useState<string | null>(null);

  // Derived fresh from props every render (never copied into local state) —
  // both the toggle action and AdmissionDocumentBox's router.refresh() cause
  // this Server Component's props to update, and a stale local copy would
  // silently stop matching the server's actual completion state.
  const done = new Set(completedTaskIds);
  const byKind = new Map(
    admissionDocuments.filter((doc) => doc.kind).map((doc) => [doc.kind as string, doc]),
  );

  async function handleToggle(taskId: string) {
    setPendingTaskId(taskId);
    try {
      await toggleOnboardingTask(taskId);
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handleToggleAccessItem(item: string) {
    setPendingAccessItem(item);
    try {
      await toggleOnboardingAccessItem(item);
    } finally {
      setPendingAccessItem(null);
    }
  }

  const percent = tasks.length === 0 ? 0 : Math.round((done.size / tasks.length) * 100);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Onboarding</h1>
      <p className={styles.itemDetail}>Complete os passos abaixo.</p>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.itemDetail}>
        {done.size} de {tasks.length} concluídos
      </p>

      <ul className={styles.list}>
        {tasks.map((task) => {
          const isDone = done.has(task.id);
          const expanded = expandedTaskId === task.id;
          return (
            <li key={task.id} className={styles.item}>
              <button
                type="button"
                className={styles.itemButton}
                disabled={pendingTaskId === task.id}
                onClick={() =>
                  task.requiresUpload ||
                  task.requiresVideo ||
                  task.showsTeam ||
                  task.requiresContract ||
                  task.requiresAccessChecklist
                    ? setExpandedTaskId(expanded ? null : task.id)
                    : handleToggle(task.id)
                }
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{task.title}</span>
                  <span className={styles.itemDetail}>{task.description}</span>
                </div>
                <div className={styles.itemRight}>
                  <span className={isDone ? styles.statusComplete : styles.statusPending}>
                    {task.requiresUpload ||
                  task.requiresVideo ||
                  task.showsTeam ||
                  task.requiresContract ||
                  task.requiresAccessChecklist
                      ? isDone
                        ? "Concluído"
                        : expanded
                          ? "Fechar"
                          : "Pendente"
                      : isDone
                        ? "Desfazer"
                        : "Concluído"}
                  </span>
                  {task.requiresUpload ||
                  task.requiresVideo ||
                  task.showsTeam ||
                  task.requiresContract ||
                  task.requiresAccessChecklist ? (
                    <svg
                      className={expanded ? `${styles.itemChevron} ${styles.itemChevronOpen}` : styles.itemChevron}
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </div>
              </button>

              {task.requiresUpload && expanded ? (
                <ul className={styles.list}>
                  {ADMISSION_DOCUMENT_KINDS.map((kind) => {
                    const existingDoc = byKind.get(kind);
                    return (
                      <li key={kind}>
                        <AdmissionDocumentBox
                          kind={kind}
                          label={ADMISSION_DOCUMENT_KIND_LABELS[kind]}
                          existing={
                            existingDoc
                              ? {
                                  status: existingDoc.status,
                                  reviewNote: existingDoc.reviewNote,
                                  submittedAtLabel: new Date(existingDoc.submittedAt).toLocaleDateString(
                                    "pt-BR",
                                    { timeZone: "UTC" },
                                  ),
                                }
                              : null
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {task.requiresVideo && expanded ? (
                <div className={styles.videoSection}>
                  <WelcomeVideoPlayer onCompleted={() => !isDone && handleToggle(task.id)} />
                </div>
              ) : null}

              {task.showsTeam && expanded ? (
                <TeamSection
                  isDone={isDone}
                  pending={pendingTaskId === task.id}
                  onToggle={() => handleToggle(task.id)}
                />
              ) : null}

              {task.requiresContract && expanded ? (
                <div className={styles.videoSection}>
                  <ContractBox
                    existing={
                      signedContract.submittedAt
                        ? {
                            submittedAtLabel: new Date(signedContract.submittedAt).toLocaleDateString("pt-BR", {
                              timeZone: "UTC",
                            }),
                          }
                        : null
                    }
                    onSubmitted={() => !isDone && handleToggle(task.id)}
                  />
                </div>
              ) : null}

              {task.requiresAccessChecklist && expanded ? (
                <AccessChecklistSection
                  completedItems={completedAccessItems}
                  pendingItem={pendingAccessItem}
                  onToggleItem={handleToggleAccessItem}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
