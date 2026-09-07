"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "./documentos.module.css";

type SubmitStatus = "idle" | "pending" | "success" | "error";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type ContractBoxExisting = { submittedAtLabel: string };

// Download the fixed template + upload the signed PDF, replacing whatever
// was sent before (see DocumentosService.submitSignedContract's upsert).
// onSubmitted is only passed by the Onboarding embedding — it's the hook
// that marks "Assinar o contrato" complete the moment a signed file lands,
// the same auto-complete-on-action shape as the welcome video's onCompleted.
export function ContractBox({
  existing,
  onSubmitted,
}: {
  existing: ContractBoxExisting | null;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    if (picked.type !== "application/pdf") {
      setFileError(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFileError(false);
    setFile(await readFileAsDataUrl(picked));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return; // native `required` on the file input already blocks this
    setStatus("pending");
    setError(null);

    // Route Handler, not a Server Action — same base64-through-Flight
    // reasoning as admission-document-box.tsx.
    const res = await fetch("/api/documentos/contrato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileDataUrl: file }),
    });

    if (!res.ok) {
      setStatus("error");
      setError(`Não foi possível enviar (código ${res.status}).`);
      return;
    }

    setFile(null);
    setResetToken((token) => token + 1);
    setStatus("success");
    onSubmitted?.();
    router.refresh();
  }

  return (
    <div className={styles.item}>
      <div className={styles.itemHeader}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>Contrato de trabalho</span>
          <span className={styles.itemDetail}>
            {existing ? `Enviado em ${existing.submittedAtLabel}` : "Nenhum contrato assinado enviado ainda."}
          </span>
        </div>
      </div>

      <a href="/documents/contrato-modelo.pdf" download className={styles.contractDownloadLink}>
        Baixar modelo do contrato
      </a>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.photoField}>
          <label htmlFor="contract-file-input">Contrato assinado (PDF)</label>
          <input
            key={resetToken}
            id="contract-file-input"
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            required
            onChange={handleFileChange}
            className={styles.fileInput}
          />
          {fileError ? <p className={styles.photoFieldError}>Formato não suportado — envie um PDF.</p> : null}
        </div>

        {status === "error" ? <p className={styles.error}>{error}</p> : null}
        {status === "success" ? <p className={styles.success}>Contrato enviado com sucesso!</p> : null}

        <button type="submit" className={styles.submitButton} disabled={status === "pending"}>
          {status === "pending" ? "Enviando…" : existing ? "Reenviar" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
