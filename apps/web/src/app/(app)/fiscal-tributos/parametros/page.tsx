import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ParametrosForm } from "./parametros-form";

export type FiscalParameters = {
  inssPatronalPercent: number | null;
  ratPercent: number | null;
  fgtsPercent: number | null;
  sujeitoDesoneracaoFolha: boolean | null;
  fonteLegal: string | null;
  vigenciaData: string | null;
} | null;

export default async function FiscalParametrosPage() {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    return <EmptyState title="Sem permissão" description="Esta área é exclusiva para gestores." />;
  }

  const parametros = await apiFetchJson<FiscalParameters>("/fiscal/parametros");

  return (
    <div>
      <h1>Parâmetros Fiscais</h1>
      <p>
        Esses valores alimentam o cálculo de encargos do dashboard Fiscal &amp; Tributos. Confirme os números com o
        contador/financeiro da empresa antes de salvar — o sistema não assume nenhum valor por conta própria.
      </p>
      <ParametrosForm parametros={parametros} />
    </div>
  );
}
