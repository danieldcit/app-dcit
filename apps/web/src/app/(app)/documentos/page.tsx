import { ADMISSION_DOCUMENT_KINDS, ADMISSION_DOCUMENT_KIND_LABELS } from "@ponto-dcit/shared-types";

import type { Session } from "@/lib/session";
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { submitCertification } from "./actions";
import { AdmissionDocumentBox } from "./admission-document-box";
import { AdmissionDocumentPhotoButton } from "./admission-document-photo-button";
import { AtestadoForm } from "./atestado-form";
import { AtestadoPhotoButton } from "./atestado-photo-button";
import { ContractBox } from "./contract-box";
import styles from "./documentos.module.css";
import { MeusAtestadosList } from "./meus-atestados-list";

type DocumentStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Reprovado",
};

// Green for aprovado, red for recusado — enviado/em_analise fall back to
// styles.status's own default (yellow), so no entry needed for them here.
const STATUS_CLASS: Partial<Record<DocumentStatus, string>> = {
  aprovado: styles.statusAprovado,
  recusado: styles.statusReprovado,
};

type Atestado = {
  id: string;
  userId: string;
  userName: string;
  cid: string | null;
  crm: string | null;
  medico: string | null;
  dias: number | null;
  status: DocumentStatus;
  createdAt: string;
};

type AdmissionDocument = {
  id: string;
  userId: string;
  userName: string;
  kind: string | null;
  title: string;
  status: DocumentStatus;
  reviewNote: string | null;
  submittedAt: string;
};

type CertificationDoc = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  institution: string;
  validUntil: string;
};

// API DateTime fields arrive as full ISO instant strings (Prisma DateTime ->
// JSON) — timeZone: "UTC" here is not cosmetic: without it, a UTC-midnight
// value shifts to the previous local day (the exact bug the Férias sub-
// project's final review caught and fixed in its own formatDate).
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Unlike formatDate above, atestado/admissional submission timestamps are
// real instants, not UTC-midnight-encoded calendar dates — gestor/RH want
// the actual wall-clock moment it was sent, so this anchors explicitly to
// São Paulo time (not the ambient server timezone, since this renders in a
// Server Component) rather than reusing formatDate's UTC anchor.
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByColaborador<T extends { userId: string; userName: string }>(
  items: T[],
): { userId: string; userName: string; items: T[] }[] {
  const groups = new Map<string, { userId: string; userName: string; items: T[] }>();
  for (const item of items) {
    const group = groups.get(item.userId);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(item.userId, { userId: item.userId, userName: item.userName, items: [item] });
    }
  }
  return [...groups.values()].sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView searchParams={searchParams} />;
  }
  return <TeamView session={session} />;
}

type SignedContractStatus = {
  userId: string;
  userName: string;
  submittedAt: string | null;
};

async function TeamView({ session }: { session: Session }) {
  const [atestados, admissionDocuments, certifications, signedContracts] = await Promise.all([
    apiFetchJson<Atestado[]>("/atestados/team"),
    apiFetchJson<AdmissionDocument[]>("/documentos/admissionais/equipe"),
    apiFetchJson<CertificationDoc[]>("/documentos/certificacoes/equipe"),
    apiFetchJson<SignedContractStatus[]>("/documentos/contrato/equipe"),
  ]);

  if (
    atestados.length === 0 &&
    admissionDocuments.length === 0 &&
    certifications.length === 0 &&
    signedContracts.length === 0
  ) {
    return (
      <EmptyState
        title="Documentos e atestados"
        description="Os documentos e atestados enviados pelos colaboradores vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Documentos e atestados</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Contratos assinados</h2>
        {signedContracts.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum colaborador ativo.</p>
        ) : (
          <ul className={styles.list}>
            {signedContracts.map((contract) => (
              <li key={contract.userId} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{contract.userName}</span>
                    <span className={styles.itemDetail}>
                      {contract.submittedAt
                        ? `Enviado em ${formatDateTime(contract.submittedAt)}`
                        : "Nenhum contrato assinado enviado ainda."}
                    </span>
                  </div>
                  {contract.submittedAt ? (
                    <div className={styles.itemActions}>
                      <a
                        href={`/api/documentos/contrato/${contract.userId}/arquivo?inline=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.contractDownloadLink}
                      >
                        Visualizar
                      </a>
                      <a
                        href={`/api/documentos/contrato/${contract.userId}/arquivo`}
                        className={styles.contractDownloadLink}
                      >
                        Baixar
                      </a>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Atestados</h2>
        {atestados.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum atestado enviado ainda.</p>
        ) : (
          <div className={styles.list}>
            {groupByColaborador(atestados).map((group) => (
              <details key={group.userId} className={styles.group}>
                <summary className={styles.groupSummary}>
                  {group.userName} ({group.items.length})
                </summary>
                <ul className={styles.list}>
                  {group.items.map((atestado) => {
                    // cid/crm/medico only arrive non-null for an RH viewer — the API
                    // masks them server-side for gestor (see AtestadosService.listTeam).
                    const hasClinicalDetail = atestado.cid || atestado.crm || atestado.medico;

                    return (
                      <li key={atestado.id} className={styles.item}>
                        <div className={styles.itemHeader}>
                          <div className={styles.itemInfo}>
                            <span className={styles.itemName}>{atestado.userName}</span>
                            <span className={styles.itemDetail}>
                              {atestado.dias != null
                                ? `${atestado.dias} dia(s)`
                                : "Dias não informados"}{" "}
                              · enviado em {formatDateTime(atestado.createdAt)}
                            </span>
                          </div>
                          <span className={`${styles.status} ${STATUS_CLASS[atestado.status] ?? ""}`}>
                            {STATUS_LABEL[atestado.status]}
                          </span>
                        </div>
                        {hasClinicalDetail ? (
                          <div className={styles.clinical}>
                            {atestado.cid ? (
                              <span>
                                <strong>CID:</strong> {atestado.cid}
                              </span>
                            ) : null}
                            {atestado.medico ? (
                              <span>
                                <strong>Médico:</strong> {atestado.medico}
                              </span>
                            ) : null}
                            {atestado.crm ? (
                              <span>
                                <strong>CRM:</strong> {atestado.crm}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {session.role === "rh" ? (
                          <AtestadoPhotoButton id={atestado.id} status={atestado.status} />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Documentos admissionais</h2>
        {admissionDocuments.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum documento admissional enviado ainda.</p>
        ) : (
          <div className={styles.list}>
            {groupByColaborador(admissionDocuments).map((group) => (
              <details key={group.userId} className={styles.group}>
                <summary className={styles.groupSummary}>
                  {group.userName} ({group.items.length})
                </summary>
                <ul className={styles.list}>
                  {group.items.map((document) => (
                    <li key={document.id} className={styles.item}>
                      <div className={styles.itemHeader}>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>{document.userName}</span>
                          <span className={styles.itemDetail}>
                            {document.title} · enviado em {formatDateTime(document.submittedAt)}
                          </span>
                        </div>
                        <span className={`${styles.status} ${STATUS_CLASS[document.status] ?? ""}`}>
                          {STATUS_LABEL[document.status]}
                        </span>
                      </div>
                      <AdmissionDocumentPhotoButton id={document.id} status={document.status} />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Certificações</h2>
        {certifications.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhuma certificação enviada ainda.</p>
        ) : (
          <div className={styles.list}>
            {groupByColaborador(certifications).map((group) => (
              <details key={group.userId} className={styles.group}>
                <summary className={styles.groupSummary}>
                  {group.userName} ({group.items.length})
                </summary>
                <ul className={styles.list}>
                  {group.items.map((certification) => (
                    <li key={certification.id} className={styles.item}>
                      <div className={styles.itemHeader}>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>{certification.userName}</span>
                          <span className={styles.itemDetail}>
                            {certification.name} · {certification.institution} · válida até{" "}
                            {formatDate(certification.validUntil)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type Categoria = "admissionais" | "atestados" | "certificacoes" | "contrato";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  admissionais: "Admissionais",
  atestados: "Atestados",
  certificacoes: "Certificações",
  contrato: "Contrato",
};

function resolveCategoria(value: string | undefined): Categoria {
  return value === "admissionais" || value === "certificacoes" || value === "contrato" ? value : "atestados";
}

type AdmissionDocumentRecord = {
  id: string;
  kind: string | null;
  title: string;
  status: DocumentStatus;
  reviewNote: string | null;
  submittedAt: string;
};

type CertificationRecord = {
  id: string;
  name: string;
  institution: string;
  validUntil: string;
};

type AtestadoRecord = {
  id: string;
  cid: string | null;
  crm: string | null;
  medico: string | null;
  dias: number | null;
  status: DocumentStatus;
  reviewNote: string | null;
  createdAt: string;
};

async function ColaboradorView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoria = resolveCategoria(typeof params.categoria === "string" ? params.categoria : undefined);

  const [admissionDocuments, certifications, atestados, signedContract] = await Promise.all([
    apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
    apiFetchJson<CertificationRecord[]>("/documentos/certificacoes"),
    apiFetchJson<AtestadoRecord[]>("/atestados/mine"),
    apiFetchJson<{ submittedAt: string | null }>("/documentos/contrato"),
  ]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Documentos</h1>

      <div className={styles.categoryTabs}>
        {(["admissionais", "atestados", "certificacoes", "contrato"] as const).map((option) => (
          <a
            key={option}
            className={
              categoria === option
                ? `${styles.categoryTab} ${styles.categoryTabActive}`
                : styles.categoryTab
            }
            href={`/documentos?categoria=${option}`}
          >
            {CATEGORIA_LABEL[option]}
          </a>
        ))}
      </div>

      {categoria === "admissionais" ? (
        <AdmissionaisSection documents={admissionDocuments} />
      ) : null}
      {categoria === "atestados" ? <AtestadosSection atestados={atestados} /> : null}
      {categoria === "certificacoes" ? (
        <CertificacoesSection certifications={certifications} />
      ) : null}
      {categoria === "contrato" ? <ContratoSection signedContract={signedContract} /> : null}
    </div>
  );
}

function ContratoSection({ signedContract }: { signedContract: { submittedAt: string | null } }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Contrato de trabalho</h2>
      <ContractBox
        existing={signedContract.submittedAt ? { submittedAtLabel: formatDate(signedContract.submittedAt) } : null}
      />
    </div>
  );
}

function AdmissionaisSection({ documents }: { documents: AdmissionDocumentRecord[] }) {
  const byKind = new Map(documents.filter((d) => d.kind).map((d) => [d.kind as string, d]));

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Documentos admissionais</h2>
      <p className={styles.sectionEmpty}>
        Envie os documentos abaixo — até 3 fotos por documento. Reenviar substitui as fotos
        anteriores e volta o status para análise.
      </p>
      <ul className={styles.list}>
        {ADMISSION_DOCUMENT_KINDS.map((kind) => {
          const existing = byKind.get(kind);
          return (
            <li key={kind}>
              <AdmissionDocumentBox
                kind={kind}
                label={ADMISSION_DOCUMENT_KIND_LABELS[kind]}
                existing={
                  existing
                    ? {
                        status: existing.status,
                        reviewNote: existing.reviewNote,
                        submittedAtLabel: formatDate(existing.submittedAt),
                      }
                    : null
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AtestadosSection({ atestados }: { atestados: AtestadoRecord[] }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Enviar atestado</h2>
      <AtestadoForm />

      <h2 className={styles.sectionTitle}>Meus atestados</h2>
      {atestados.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhum atestado enviado ainda.</p>
      ) : (
        <MeusAtestadosList atestados={atestados} />
      )}
    </div>
  );
}

function CertificacoesSection({ certifications }: { certifications: CertificationRecord[] }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Adicionar certificação</h2>
      <form className={styles.form} action={submitCertification}>
        <label htmlFor="name">Nome</label>
        <input id="name" name="name" type="text" className={styles.textInput} required />
        <label htmlFor="institution">Instituição</label>
        <input id="institution" name="institution" type="text" className={styles.textInput} required />
        <label htmlFor="validUntil">Válida até (DD/MM/AAAA)</label>
        <input
          id="validUntil"
          name="validUntil"
          type="text"
          placeholder="DD/MM/AAAA"
          pattern="\d{2}/\d{2}/\d{4}"
          className={styles.textInput}
          required
        />
        <button type="submit" className={styles.submitButton}>
          Salvar
        </button>
      </form>

      <h2 className={styles.sectionTitle}>Minhas certificações</h2>
      {certifications.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhuma certificação cadastrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {certifications.map((certification) => (
            <li key={certification.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{certification.name}</span>
                  <span className={styles.itemDetail}>
                    {certification.institution} · válida até {formatDate(certification.validUntil)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
