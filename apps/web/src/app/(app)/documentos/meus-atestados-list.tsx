"use client";

import { useState } from "react";

import styles from "./documentos.module.css";

type DocumentStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Reprovado",
};

// Duplicated from page.tsx (this codebase's convention: small date helpers
// are duplicated per-file rather than shared — see horas/actions.ts).
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export type AtestadoRecord = {
  id: string;
  dias: number | null;
  status: DocumentStatus;
  reviewNote: string | null;
  createdAt: string;
};

const INITIAL_VISIBLE_COUNT = 5;

// Collapsed to the most recent few by default — a colaborador with many
// months of atestados otherwise dumps the whole history on screen at once.
// "Ver mais" reveals the rest in one step rather than paging repeatedly,
// since the full list is rarely more than a screen or two once expanded.
export function MeusAtestadosList({ atestados }: { atestados: AtestadoRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? atestados : atestados.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = atestados.length - visible.length;

  return (
    <>
      <ul className={styles.list}>
        {visible.map((atestado) => (
          <li key={atestado.id} className={styles.item}>
            <div className={styles.itemHeader}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"}
                </span>
                <span className={styles.itemDetail}>Enviado em {formatDate(atestado.createdAt)}</span>
                {atestado.reviewNote ? <span className={styles.itemNote}>{atestado.reviewNote}</span> : null}
              </div>
              <span className={`${styles.status} ${atestado.status === "aprovado" ? styles.statusAprovado : ""}`}>
                {STATUS_LABEL[atestado.status]}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button type="button" className={styles.showMoreButton} onClick={() => setExpanded(true)}>
          Ver mais ({hiddenCount})
        </button>
      ) : null}
      {expanded && atestados.length > INITIAL_VISIBLE_COUNT ? (
        <button type="button" className={styles.showMoreButton} onClick={() => setExpanded(false)}>
          Ver menos
        </button>
      ) : null}
    </>
  );
}
