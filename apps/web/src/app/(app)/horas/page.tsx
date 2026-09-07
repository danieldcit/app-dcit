import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { HistoricoColaboradorSelect } from "./historico-colaborador-select";
import { HistoricoSection } from "./historico-section";
import { HorasChart } from "./horas-chart";
import styles from "./horas.module.css";
import { LancarHorasForm } from "./lancar-horas-form";

type HorasResumoItem = { userId: string; name: string; horasTrabalhadas: number; horasExtras: number; horasTickets: number };
type Employee = { userId: string; name: string };

const PERIODOS = ["dia", "semana", "mes"] as const;
type Periodo = (typeof PERIODOS)[number];

const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
};

function resolvePeriodo(value: string | undefined): Periodo {
  return value === "dia" || value === "semana" ? value : "mes";
}

export default async function HorasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita a gestores." />;
  }

  const params = await searchParams;
  const periodoParam = params.periodo;
  const periodo = resolvePeriodo(typeof periodoParam === "string" ? periodoParam : undefined);

  const colaboradorParam = params.colaborador;
  const colaboradorId = typeof colaboradorParam === "string" ? colaboradorParam : undefined;

  const [resumo, employees] = await Promise.all([
    apiFetchJson<HorasResumoItem[]>(`/horas/resumo?periodo=${periodo}`),
    apiFetchJson<Employee[]>("/employees"),
  ]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Horas</h1>

      <nav className={styles.periodTabs}>
        {PERIODOS.map((option) => (
          <a
            key={option}
            className={periodo === option ? `${styles.periodTab} ${styles.periodTabActive}` : styles.periodTab}
            href={`/horas?periodo=${option}${colaboradorId ? `&colaborador=${colaboradorId}` : ""}`}
          >
            {PERIODO_LABEL[option]}
          </a>
        ))}
      </nav>

      <HorasChart data={resumo} metaTickets={periodo === "mes" ? 60 : undefined} />

      <div className={styles.formsRow}>
        <LancarHorasForm employees={employees.map(({ userId, name }) => ({ userId, name }))} />
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Histórico</h2>
          <form className={styles.selector}>
            <label htmlFor="colaborador">Ver lançamentos de</label>
            <HistoricoColaboradorSelect
              employees={employees.map(({ userId, name }) => ({ userId, name }))}
              colaboradorId={colaboradorId ?? ""}
            />
            <input type="hidden" name="periodo" value={periodo} />
          </form>
          {colaboradorId ? <HistoricoSection userId={colaboradorId} periodo={periodo} /> : null}
        </div>
      </div>
    </div>
  );
}
