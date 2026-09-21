import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { FiscalDashboardView } from "./fiscal-dashboard-view";

export type FiscalDashboard = {
  headcountTotal: number;
  headcountPorTipo: { CLT: number; PJ: number; terceirizado: number; naoClassificado: number };
  custoBase: number;
  custoBeneficios: number;
  encargos: number | null;
  encargosConfigurados: boolean;
  custoMensalTotal: number;
  custoMedioPorColaborador: number;
  colaboradoresSemSalario: number;
  naoClassificados: { userId: string; name: string }[];
};

export default async function FiscalTributosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    return <EmptyState title="Sem permissão" description="Esta área é exclusiva para gestores." />;
  }

  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.team === "string" && params.team) query.set("team", params.team);
  if (typeof params.tipoContratacao === "string" && params.tipoContratacao) {
    query.set("tipoContratacao", params.tipoContratacao);
  }
  const queryString = query.toString();

  const dashboard = await apiFetchJson<FiscalDashboard>(
    `/fiscal/dashboard${queryString ? `?${queryString}` : ""}`,
  );

  return (
    <FiscalDashboardView
      dashboard={dashboard}
      naoClassificados={dashboard.naoClassificados}
      team={typeof params.team === "string" ? params.team : ""}
      tipoContratacao={typeof params.tipoContratacao === "string" ? params.tipoContratacao : ""}
    />
  );
}
