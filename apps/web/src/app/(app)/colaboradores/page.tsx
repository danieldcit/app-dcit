import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradoresList } from "./colaboradores-list";
import { LixeiraSection } from "./lixeira-section";
import { NovoColaboradorDialog } from "./novo-colaborador-dialog";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  role: "colaborador" | "gestor" | "rh";
  email: string | null;
  cargo: string | null;
  team: string | null;
  nivel: string | null;
  convencaoId: string | null;
  salarioMensal: number | null;
  hireDate: string;
  expectedStartTime: string | null;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || (session.role !== "rh" && session.role !== "gestor")) {
    return <EmptyState title="Sem permissão" description="Esta página é restrita a RH e gestores." />;
  }

  const [employees, convencoes] = await Promise.all([
    apiFetchJson<Employee[]>("/employees"),
    apiFetchJson<{ id: string; nome: string }[]>("/convencoes").catch(() => []),
  ]);

  const params = await searchParams;
  const highlightIds =
    typeof params.semSalario === "string" && params.semSalario
      ? params.semSalario.split(",").filter(Boolean)
      : [];

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Colaboradores</h1>
        <NovoColaboradorDialog convencoes={convencoes} />
      </div>
      <p className={styles.subheading}>
        Defina o horário esperado de entrada de cada colaborador — usado para marcá-lo como
        atrasado no painel de presença.
      </p>
      {highlightIds.length > 0 ? (
        <p className={styles.highlightBanner}>
          Mostrando {highlightIds.length} colaborador(es) sem salário cadastrado, destacado(s) abaixo.{" "}
          <a href="/colaboradores">Limpar destaque</a>
        </p>
      ) : null}
      {employees.length === 0 ? (
        <p className={styles.subheading}>Nenhum colaborador cadastrado ainda.</p>
      ) : (
        <ColaboradoresList employees={employees} convencoes={convencoes} highlightIds={highlightIds} />
      )}
      <LixeiraSection />
    </div>
  );
}
