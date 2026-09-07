import { apiFetchJson } from "@/lib/api";

import { excluirLancamento } from "./actions";
import styles from "./horas.module.css";

type HistoricoDia = {
  date: string;
  horasTrabalhadas: number;
  horasExtras: number;
  horasTickets: number;
  ticketEntryId: string | null;
};

// date is a bare "YYYY-MM-DD" (see HorasService.list) — new Date(value) with
// an explicit UTC timeZone reads it as the same calendar day, matching this
// app's established formatDateOnly convention (see aprovacoes/page.tsx).
function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export async function HistoricoSection({ userId, periodo }: { userId: string; periodo: string }) {
  const dias = await apiFetchJson<HistoricoDia[]>(`/horas?userId=${userId}&periodo=${periodo}`);

  if (dias.length === 0) {
    return <p className={styles.empty}>Nenhum lançamento neste período.</p>;
  }

  return (
    <ul className={styles.list}>
      {dias.map((dia) => (
        <li key={dia.date} className={styles.item}>
          <span>
            {formatDateOnly(dia.date)} — {dia.horasTrabalhadas}h trabalhadas
            {dia.horasExtras > 0 ? ` · ${dia.horasExtras}h extras` : ""} · {dia.horasTickets}h em tickets
          </span>
          {dia.ticketEntryId ? (
            <form action={excluirLancamento}>
              <input type="hidden" name="id" value={dia.ticketEntryId} />
              <button type="submit" className={styles.deleteButton}>
                Excluir
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
