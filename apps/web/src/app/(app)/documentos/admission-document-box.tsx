"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "./documentos.module.css";

type SubmitStatus = "idle" | "pending" | "success" | "error";
type DocStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

const STATUS_LABEL: Record<DocStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Reprovado",
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTOS = 3;

// Purely a display label for the file input — upload behavior (still up to
// MAX_PHOTOS files accepted) is unchanged for every kind. RG and CPF get a
// descriptive label; the other kinds (comprovante de endereço, certidões)
// show no photo-count caption at all, since "(até 3)" read as misleading
// for a document that's really just one photo.
const PHOTO_FIELD_LABEL: Partial<Record<string, string>> = {
  rg: "Fotos (Frente e Verso)",
  cpf: "Foto (Frente)",
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type AdmissionDocumentBoxExisting = {
  status: DocStatus;
  reviewNote: string | null;
  submittedAtLabel: string;
};

// One fixed document type (RG, CPF, ...) — upload + current status live in
// the same box, since resubmitting replaces the whole photo set rather than
// piling up a history (see DocumentosService.createAdmissionDocument).
export function AdmissionDocumentBox({
  kind,
  label,
  existing,
}: {
  kind: string;
  label: string;
  existing: AdmissionDocumentBoxExisting | null;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [fileError, setFileError] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS);
    if (files.length === 0) return;
    if (files.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
      setFileError(true);
      setPhotos([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFileError(false);
    setPhotos(await Promise.all(files.map(readFileAsDataUrl)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photos.length === 0) return; // native `required` on the file input already blocks this
    setStatus("pending");
    setError(null);

    // Route Handler, not a Server Action — see apps/web/src/app/api/atestados/route.ts
    // for why (a real photo's base64 breaks React's Flight serialization).
    const res = await fetch("/api/documentos/admissionais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, photos }),
    });

    if (!res.ok) {
      setStatus("error");
      setError(`Não foi possível enviar (código ${res.status}).`);
      return;
    }

    setPhotos([]);
    setResetToken((token) => token + 1);
    setStatus("success");
    router.refresh();
  }

  return (
    <div className={styles.item}>
      <div className={styles.itemHeader}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{label}</span>
          <span className={styles.itemDetail}>
            {existing ? `Enviado em ${existing.submittedAtLabel}` : "Nenhum documento enviado ainda."}
          </span>
          {existing?.reviewNote ? <span className={styles.itemNote}>{existing.reviewNote}</span> : null}
        </div>
        {existing ? (
          <span
            className={`${styles.status} ${existing.status === "aprovado" ? styles.statusAprovado : ""}`}
          >
            {STATUS_LABEL[existing.status]}
          </span>
        ) : null}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.photoField}>
          {PHOTO_FIELD_LABEL[kind] ? <label htmlFor={`${kind}-photos-input`}>{PHOTO_FIELD_LABEL[kind]}</label> : null}
          <input
            key={resetToken}
            id={`${kind}-photos-input`}
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            required
            aria-label={PHOTO_FIELD_LABEL[kind] ?? `Foto de ${label}`}
            onChange={handleFilesChange}
            className={styles.fileInput}
          />
          {fileError ? (
            <p className={styles.photoFieldError}>Formato não suportado — use JPEG, PNG ou WEBP.</p>
          ) : null}
          {photos.length > 0 ? (
            <div className={styles.photoPreviewRow}>
              {photos.map((photo, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
                <img key={index} src={photo} alt="Pré-visualização" className={styles.photoPreview} />
              ))}
            </div>
          ) : null}
        </div>

        {status === "error" ? <p className={styles.error}>{error}</p> : null}
        {status === "success" ? <p className={styles.success}>Documento enviado com sucesso!</p> : null}

        <div className={styles.submitRow}>
          <button type="submit" className={styles.submitButton} disabled={status === "pending"}>
            {status === "pending" ? "Enviando…" : existing ? "Reenviar" : "Enviar"}
          </button>
          {existing && (existing.status === "enviado" || existing.status === "em_analise") ? (
            <span className={styles.pendingBadge}>Em análise</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
