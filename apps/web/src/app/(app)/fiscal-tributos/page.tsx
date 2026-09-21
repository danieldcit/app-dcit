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
  encargosPercentual: number | null;
  encargosBreakdown: { inssPatronal: number; rat: number; terceiros: number; fgts: number; total: number } | null;
  encargosPercentuais: { inssPatronal: number; rat: number; terceiros: number; fgts: number } | null;
  folhaCLTConsiderada: number;
  cltComSalario: number;
  custoMensalTotal: number;
  custoMedioPorColaborador: number;
  custoMedioComDadosCompletos: number | null;
  custosPorColaborador: {
    userId: string;
    name: string;
    tipoContratacao: string | null;
    salarioMensal: number | null;
    encargos: number | null;
    encargosBreakdown: { inssPatronal: number; rat: number; terceiros: number; fgts: number; total: number } | null;
    beneficios: number;
    custoTotal: number;
  }[];
  variacaoCustoMensalPercent: number | null;
  variacaoCustoMedioPercent: number | null;
  colaboradoresSemSalario: number;
  naoClassificados: { userId: string; name: string }[];
  semSalario: { userId: string; name: string }[];
  parametrosAtualizadoEm: string | null;
  parametrosVigenciaData: string | null;
  historico: { month: string; custoMensalTotal: number; headcountTotal: number }[];
  historicoCombinacaoNaoSuportada: boolean;
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
