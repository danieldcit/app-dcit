import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradorOnboarding } from "./colaborador-onboarding";
import { OnboardingRow } from "./onboarding-row";
import styles from "./onboarding.module.css";

type Task = {
  id: string;
  title: string;
  description: string;
  requiresUpload: boolean;
};

type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
};

type AdmissionDocumentRecord = {
  id: string;
  kind: string | null;
  title: string;
  status: "enviado" | "em_analise" | "aprovado" | "recusado";
  reviewNote: string | null;
  submittedAt: string;
};

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }

  if (session.role === "colaborador") {
    const [{ tasks, completedTaskIds }, admissionDocuments] = await Promise.all([
      apiFetchJson<{ tasks: Task[]; completedTaskIds: string[] }>("/onboarding/tarefas"),
      apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
    ]);
    return (
      <ColaboradorOnboarding
        tasks={tasks}
        completedTaskIds={completedTaskIds}
        admissionDocuments={admissionDocuments}
      />
    );
  }

  const progress = await apiFetchJson<TeamProgress[]>("/onboarding/equipe");

  if (progress.length === 0) {
    return (
      <EmptyState
        title="Onboarding"
        description="O progresso de integração dos colaboradores vai aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Onboarding</h1>
      <ul className={styles.list}>
        {progress.map((entry) => (
          <OnboardingRow key={entry.userId} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
