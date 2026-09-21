"use client";

import Link from "next/link";
import { useRef } from "react";

import type { FiscalDashboard } from "./page";
import styles from "./fiscal-tributos.module.css";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERCENT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const RAT_LABEL: Record<number, string> = { 1: "Risco Leve", 2: "Risco Médio", 3: "Risco Grave" };

function aliquota(value: number): string {
  return `${PERCENT.format(value)}%`;
}

export function EncargosCard({ dashboard }: { dashboard: FiscalDashboard }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <section className={styles.card}>
      <h2>🏛️ Encargos e obrigações governamentais</h2>
      {dashboard.encargosBreakdown !== null && dashboard.encargosPercentuais !== null ? (
        <>
          <p className={styles.bigNumber}>{BRL.format(dashboard.encargosBreakdown.total)} / mês</p>
          <ul className={styles.compositionList}>
            <li className={styles.compositionRow}>
              <span>INSS patronal</span>
              <span>
                {BRL.format(dashboard.encargosBreakdown.inssPatronal)} ({aliquota(dashboard.encargosPercentuais.inssPatronal)})
              </span>
            </li>
            <li className={styles.compositionRow}>
              <span>RAT</span>
              <span>
                {BRL.format(dashboard.encargosBreakdown.rat)} ({aliquota(dashboard.encargosPercentuais.rat)}
                {RAT_LABEL[dashboard.encargosPercentuais.rat] ? ` - ${RAT_LABEL[dashboard.encargosPercentuais.rat]}` : ""})
              </span>
            </li>
            {dashboard.encargosBreakdown.terceiros > 0 ? (
              <li className={styles.compositionRow}>
                <span>Terceiros / Sistema S</span>
                <span>
                  {BRL.format(dashboard.encargosBreakdown.terceiros)} ({aliquota(dashboard.encargosPercentuais.terceiros)})
                </span>
              </li>
            ) : null}
            <li className={styles.compositionRow}>
              <span>FGTS</span>
              <span>
                {BRL.format(dashboard.encargosBreakdown.fgts)} ({aliquota(dashboard.encargosPercentuais.fgts)})
              </span>
            </li>
          </ul>
          <p className={styles.cardSubtext}>
            {PERCENT.format(dashboard.encargosPercentual ?? 0)}% sobre a folha CLT considerada
          </p>
          <p className={styles.cardSubtext}>
            Base considerada: {BRL.format(dashboard.folhaCLTConsiderada)}{" "}
            <span
              className={styles.helpIcon}
              title={`Soma apenas o salário dos ${dashboard.cltComSalario} colaborador(es) CLT com salário cadastrado. Colaboradores PJ, Terceirizados e CLT sem salário cadastrado não entram nesta base, pois INSS patronal/RAT/Terceiros/FGTS incidem só sobre a folha CLT.`}
            >
              ?
            </span>
          </p>
          <button type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.showModal()}>
            Ver memória de cálculo →
          </button>
        </>
      ) : (
        <>
          <p>Configure os parâmetros fiscais da empresa para ver os encargos estimados.</p>
          <Link href="/fiscal-tributos/parametros">Configurar parâmetros fiscais</Link>
        </>
      )}

      {dashboard.encargosBreakdown !== null && dashboard.encargosPercentuais !== null ? (
        <dialog ref={dialogRef} className={styles.dialog}>
          <p className={styles.dialogTitle}>Detalhamento de Encargos Governamentais (Consolidado)</p>
          <p className={styles.cardSubtext}>Base de Cálculo Total (Folha CLT): {BRL.format(dashboard.folhaCLTConsiderada)}</p>
          <p className={styles.raioXTotal}>Composição dos Tributos:</p>
          <ul className={styles.compositionList}>
            <li className={styles.compositionRow}>
              <span>INSS Patronal ({aliquota(dashboard.encargosPercentuais.inssPatronal)})</span>
              <span>{BRL.format(dashboard.encargosBreakdown.inssPatronal)}</span>
            </li>
            <li className={styles.compositionRow}>
              <span>
                RAT ({aliquota(dashboard.encargosPercentuais.rat)}
                {RAT_LABEL[dashboard.encargosPercentuais.rat] ? ` - ${RAT_LABEL[dashboard.encargosPercentuais.rat]}` : ""})
              </span>
              <span>{BRL.format(dashboard.encargosBreakdown.rat)}</span>
            </li>
            {dashboard.encargosBreakdown.terceiros > 0 ? (
              <li className={styles.compositionRow}>
                <span>Terceiros / Sistema S ({aliquota(dashboard.encargosPercentuais.terceiros)})</span>
                <span>{BRL.format(dashboard.encargosBreakdown.terceiros)}</span>
              </li>
            ) : null}
            <li className={styles.compositionRow}>
              <span>FGTS ({aliquota(dashboard.encargosPercentuais.fgts)})</span>
              <span>{BRL.format(dashboard.encargosBreakdown.fgts)}</span>
            </li>
          </ul>
          <p className={styles.raioXTotal}>
            Total Geral de Encargos Governamentais: <strong>{BRL.format(dashboard.encargosBreakdown.total)} / mês</strong>
          </p>
          <button type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.close()}>
            Fechar
          </button>
        </dialog>
      ) : null}
    </section>
  );
}
