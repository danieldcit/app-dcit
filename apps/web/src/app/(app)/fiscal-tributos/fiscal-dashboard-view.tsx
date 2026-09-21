import Link from "next/link";

import type { FiscalDashboard } from "./page";
import { ClassificarTipoForm } from "./classificar-tipo-form";
import styles from "./fiscal-tributos.module.css";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function FiscalDashboardView({
  dashboard,
  naoClassificados,
  team,
  tipoContratacao,
}: {
  dashboard: FiscalDashboard;
  naoClassificados: { userId: string; name: string }[];
  team: string;
  tipoContratacao: string;
}) {
  return (
    <div className={styles.page}>
      <h1>Fiscal &amp; Tributos 2026</h1>

      <form className={styles.filters} method="get">
        <label htmlFor="team">Time</label>
        <input id="team" name="team" defaultValue={team} placeholder="Todos" />
        <label htmlFor="tipoContratacao">Tipo de contratação</label>
        <select id="tipoContratacao" name="tipoContratacao" defaultValue={tipoContratacao}>
          <option value="">Todos</option>
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="terceirizado">Terceirizado</option>
        </select>
        <button type="submit">Filtrar</button>
      </form>

      <div className={styles.cards}>
        <section className={styles.card}>
          <h2>Headcount</h2>
          <p className={styles.bigNumber}>{dashboard.headcountTotal}</p>
          <ul>
            <li>CLT: {dashboard.headcountPorTipo.CLT}</li>
            <li>PJ: {dashboard.headcountPorTipo.PJ}</li>
            <li>Terceirizado: {dashboard.headcountPorTipo.terceirizado}</li>
            <li>Não classificado: {dashboard.headcountPorTipo.naoClassificado}</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2>Custo mensal da equipe</h2>
          <p className={styles.bigNumber}>{BRL.format(dashboard.custoMensalTotal)}</p>
          <ul>
            <li>Salários/contratos: {BRL.format(dashboard.custoBase)}</li>
            <li>Benefícios: {BRL.format(dashboard.custoBeneficios)}</li>
            {dashboard.encargos !== null ? (
              <li>Encargos (CLT): {BRL.format(dashboard.encargos)}</li>
            ) : null}
          </ul>
          {dashboard.colaboradoresSemSalario > 0 ? (
            <p className={styles.warning}>
              {dashboard.colaboradoresSemSalario} colaborador(es) sem salário cadastrado — não entram na soma.
            </p>
          ) : null}
        </section>

        <section className={styles.card}>
          <h2>Custo médio por colaborador</h2>
          <p className={styles.bigNumber}>{BRL.format(dashboard.custoMedioPorColaborador)}</p>
        </section>

        <section className={styles.card}>
          <h2>Impacto tributário estimado</h2>
          {dashboard.encargos !== null ? (
            <p className={styles.bigNumber}>{BRL.format(dashboard.encargos)}</p>
          ) : (
            <>
              <p>Configure os parâmetros fiscais da empresa para ver o impacto tributário estimado.</p>
              <Link href="/fiscal-tributos/parametros">Configurar parâmetros fiscais</Link>
            </>
          )}
        </section>
      </div>

      {naoClassificados.length > 0 ? (
        <section className={styles.card}>
          <h2>Colaboradores não classificados ({naoClassificados.length})</h2>
          <ul className={styles.classificationList}>
            {naoClassificados.map((employee) => (
              <li key={employee.userId}>
                <span>{employee.name}</span>
                <ClassificarTipoForm userId={employee.userId} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
