import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { HoleritesRow } from "./holerites-row";
import { NovoHoleriteDialog } from "./novo-holerite-dialog";
import styles from "./holerites.module.css";

type Holerite = {
  id: string;
  userId: string;
  userName: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

type Employee = { userId: string; name: string };

type HoleriteGroup = { userId: string; userName: string; holerites: Holerite[] };

function groupByColaborador(holerites: Holerite[]): HoleriteGroup[] {
  const groups = new Map<string, HoleriteGroup>();
  for (const holerite of holerites) {
    const group = groups.get(holerite.userId);
    if (group) {
      group.holerites.push(holerite);
    } else {
      groups.set(holerite.userId, {
        userId: holerite.userId,
        userName: holerite.userName,
        holerites: [holerite],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function MinhasHoleritesView() {
  const holerites = await apiFetchJson<Holerite[]>("/documentos/holerites");

  if (holerites.length === 0) {
    return (
      <EmptyState
        title="Holerites"
        description="Seus holerites vão aparecer aqui assim que o RH lançar o primeiro."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Holerites</h1>
      <ul className={styles.list}>
        {holerites.map((holerite) => {
          const liquido = holerite.gross - holerite.inss - holerite.irrf - holerite.benefits;
          return (
            <li key={holerite.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{holerite.label}</span>
                <span className={styles.itemDetail}>
                  Bruto: {formatBRL(holerite.gross)} · INSS: {formatBRL(holerite.inss)} · IRRF:{" "}
                  {formatBRL(holerite.irrf)} · Descontos de benefícios: {formatBRL(holerite.benefits)} ·
                  Líquido: {formatBRL(liquido)}
                </span>
              </div>
              <a
                href={`/api/documentos/holerites/${holerite.id}/arquivo`}
                download
                className={styles.downloadLink}
              >
                Baixar PDF
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function HoleritesPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <MinhasHoleritesView />;
  }

  const [holerites, employees] = await Promise.all([
    apiFetchJson<Holerite[]>("/documentos/holerites/equipe"),
    apiFetchJson<Employee[]>("/employees").catch(() => []),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Holerites</h1>
        <NovoHoleriteDialog employees={employees} />
      </div>
      {holerites.length === 0 ? (
        <p className={styles.subheading}>Nenhum holerite cadastrado ainda.</p>
      ) : (
        <div className={styles.list}>
          {groupByColaborador(holerites).map((group) => (
            <details key={group.userId} className={styles.group}>
              <summary className={styles.groupSummary}>
                {group.userName} ({group.holerites.length})
              </summary>
              <ul className={styles.list}>
                {group.holerites.map((holerite) => (
                  <HoleritesRow key={holerite.id} holerite={holerite} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
