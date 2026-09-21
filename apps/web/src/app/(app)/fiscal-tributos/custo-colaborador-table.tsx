"use client";

import { useRef, useState } from "react";

import styles from "./fiscal-tributos.module.css";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERCENT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const TIPO_LABEL: Record<string, string> = { CLT: "CLT", PJ: "PJ", terceirizado: "Terceirizado" };

type EncargosBreakdown = { inssPatronal: number; rat: number; terceiros: number; fgts: number; total: number };

type Colaborador = {
  userId: string;
  name: string;
  tipoContratacao: string | null;
  salarioMensal: number | null;
  encargos: number | null;
  encargosBreakdown: EncargosBreakdown | null;
  beneficios: number;
  custoTotal: number;
};

function nd(text: string | null): string {
  return text ?? "N/D";
}

function money(value: number | null): string {
  return value !== null ? BRL.format(value) : "N/D";
}

export function CustoColaboradorTable({ colaboradores }: { colaboradores: Colaborador[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selecionado, setSelecionado] = useState<Colaborador | null>(null);

  function abrirDetalhamento(colaborador: Colaborador) {
    setSelecionado(colaborador);
    dialogRef.current?.showModal();
  }

  const mostrarTerceiros = colaboradores.some((c) => (c.encargosBreakdown?.terceiros ?? 0) > 0);
  const pendingColSpan = mostrarTerceiros ? 8 : 7;

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.colaboradorTable}>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Tipo</th>
              <th>Salário bruto</th>
              <th>INSS Patronal</th>
              <th>RAT</th>
              {mostrarTerceiros ? <th>Terceiros</th> : null}
              <th>FGTS</th>
              <th>Total Encargos</th>
              <th>Benefícios</th>
              <th>Custo total</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c) =>
              c.salarioMensal === null ? (
                <tr key={c.userId} className={styles.colaboradorTableRowPending}>
                  <td>{c.name}</td>
                  <td>{nd(c.tipoContratacao ? (TIPO_LABEL[c.tipoContratacao] ?? c.tipoContratacao) : null)}</td>
                  <td colSpan={pendingColSpan} className={styles.pendingStatus}>
                    ⏳ Aguardando cadastro de salário
                  </td>
                </tr>
              ) : (
                <tr
                  key={c.userId}
                  className={styles.colaboradorTableRow}
                  onClick={() => abrirDetalhamento(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") abrirDetalhamento(c);
                  }}
                >
                  <td>{c.name}</td>
                  <td>{nd(c.tipoContratacao ? (TIPO_LABEL[c.tipoContratacao] ?? c.tipoContratacao) : null)}</td>
                  <td>{money(c.salarioMensal)}</td>
                  <td>{money(c.encargosBreakdown?.inssPatronal ?? null)}</td>
                  <td>{money(c.encargosBreakdown?.rat ?? null)}</td>
                  {mostrarTerceiros ? <td>{money(c.encargosBreakdown?.terceiros ?? null)}</td> : null}
                  <td>{money(c.encargosBreakdown?.fgts ?? null)}</td>
                  <td>{money(c.encargos)}</td>
                  <td>{c.beneficios > 0 ? BRL.format(c.beneficios) : "N/D"}</td>
                  <td>
                    {BRL.format(c.custoTotal)} <span className={styles.colaboradorTableChevron}>›</span>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <dialog ref={dialogRef} className={styles.dialog}>
        {selecionado ? (
          <>
            <p className={styles.dialogTitle}>{selecionado.name} — memória de cálculo</p>
            <ul className={styles.compositionList}>
              <li className={styles.compositionRow}>
                <span>Salário bruto</span>
                <span>{money(selecionado.salarioMensal)}</span>
              </li>
              {selecionado.encargosBreakdown ? (
                <>
                  <li className={styles.compositionRow}>
                    <span>INSS patronal</span>
                    <span>{BRL.format(selecionado.encargosBreakdown.inssPatronal)}</span>
                  </li>
                  <li className={styles.compositionRow}>
                    <span>RAT</span>
                    <span>{BRL.format(selecionado.encargosBreakdown.rat)}</span>
                  </li>
                  {selecionado.encargosBreakdown.terceiros > 0 ? (
                    <li className={styles.compositionRow}>
                      <span>Terceiros / Sistema S</span>
                      <span>{BRL.format(selecionado.encargosBreakdown.terceiros)}</span>
                    </li>
                  ) : null}
                  <li className={styles.compositionRow}>
                    <span>FGTS</span>
                    <span>{BRL.format(selecionado.encargosBreakdown.fgts)}</span>
                  </li>
                </>
              ) : (
                <li className={styles.compositionRow}>
                  <span>Encargos</span>
                  <span>
                    N/D —{" "}
                    {selecionado.tipoContratacao !== "CLT"
                      ? "só colaboradores CLT têm encargos calculados"
                      : "parâmetros fiscais não configurados"}
                  </span>
                </li>
              )}
              <li className={styles.compositionRow}>
                <span>Benefícios</span>
                <span>{BRL.format(selecionado.beneficios)}</span>
              </li>
              <li className={styles.compositionRow}>
                <span>
                  <strong>Custo total</strong>
                </span>
                <span>
                  <strong>{BRL.format(selecionado.custoTotal)}</strong>
                </span>
              </li>
            </ul>
            {selecionado.encargosBreakdown && selecionado.salarioMensal ? (
              <p className={styles.cardSubtext}>
                {PERCENT.format((selecionado.encargosBreakdown.total / selecionado.salarioMensal) * 100)}% de
                encargos sobre o salário bruto
              </p>
            ) : null}
            <button type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.close()}>
              Fechar
            </button>
          </>
        ) : null}
      </dialog>
    </>
  );
}
