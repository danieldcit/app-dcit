"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

import { PhotoUploadField, type PickedPhoto } from "./photo-upload-field";
import styles from "./documentos.module.css";

type OcrStatus = "idle" | "loading" | "done" | "error";
type SubmitStatus = "idle" | "pending" | "success" | "error";

export function AtestadoForm() {
  const router = useRouter();
  const [cid, setCid] = useState("");
  const [crm, setCrm] = useState("");
  const [medico, setMedico] = useState("");
  const [dias, setDias] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoResetToken, setPhotoResetToken] = useState(0);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handlePhotoPicked(picked: PickedPhoto) {
    setPhotoDataUrl(picked.dataUrl);
    setOcrStatus("loading");
    // Route Handler, not the old runAtestadoOcr Server Action — calling a
    // Server Action directly as a function still serializes its arguments
    // through React's Flight protocol, which breaks on a real photo's
    // base64 size just like a <form action> submission does. See
    // apps/web/src/app/api/atestados/ocr/route.ts.
    const res = await fetch("/api/atestados/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: picked.base64, mediaType: picked.mediaType }),
    });
    if (!res.ok) {
      setOcrStatus("error");
      return;
    }
    const result = (await res.json()) as {
      cid: string | null;
      crm: string | null;
      medico: string | null;
      dias: number | null;
    };
    if (result.cid) setCid(result.cid);
    if (result.crm) setCrm(result.crm);
    if (result.medico) setMedico(result.medico);
    if (result.dias) setDias(String(result.dias));
    setOcrStatus("done");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoDataUrl) return; // native `required` on the file input already blocks this
    setSubmitStatus("pending");
    setSubmitError(null);

    // A plain fetch to a Route Handler, not a Server Action — a real photo's
    // base64 payload (a few MB) breaks React's Flight serialization for
    // Server Action arguments ("Maximum array nesting exceeded") long before
    // it would ever hit the API's own body limit. See
    // apps/web/src/app/api/atestados/route.ts.
    const res = await fetch("/api/atestados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid: cid.trim(),
        crm: crm.trim(),
        medico: medico.trim(),
        dias: Number.parseInt(dias, 10),
        photoDataUrl,
      }),
    });

    if (!res.ok) {
      setSubmitStatus("error");
      setSubmitError(`Não foi possível enviar (código ${res.status}).`);
      return;
    }

    setCid("");
    setCrm("");
    setMedico("");
    setDias("");
    setPhotoDataUrl(null);
    setPhotoResetToken((token) => token + 1);
    setOcrStatus("idle");
    setSubmitStatus("success");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <PhotoUploadField
        key={photoResetToken}
        name="photo"
        label="Foto do atestado"
        required
        onPicked={handlePhotoPicked}
      />

      {ocrStatus !== "idle" ? (
        <p className={styles.ocrStatus}>
          {ocrStatus === "loading"
            ? "Lendo o atestado automaticamente…"
            : ocrStatus === "done"
              ? "Dados preenchidos automaticamente — confira antes de enviar."
              : "Não foi possível ler automaticamente — preencha os dados abaixo manualmente."}
        </p>
      ) : null}

      <label htmlFor="cid">CID</label>
      <input
        id="cid"
        name="cid"
        type="text"
        value={cid}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setCid(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="crm">CRM do médico</label>
      <input
        id="crm"
        name="crm"
        type="text"
        value={crm}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setCrm(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="medico">Nome do médico</label>
      <input
        id="medico"
        name="medico"
        type="text"
        value={medico}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setMedico(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="dias">Quantidade de dias</label>
      <input
        id="dias"
        name="dias"
        type="number"
        min="1"
        step="1"
        value={dias}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDias(event.target.value)}
        className={styles.textInput}
        required
      />

      {submitStatus === "error" ? <p className={styles.error}>{submitError}</p> : null}
      {submitStatus === "success" ? (
        <p className={styles.success}>Atestado enviado com sucesso!</p>
      ) : null}

      <button type="submit" className={styles.submitButton} disabled={submitStatus === "pending"}>
        {submitStatus === "pending" ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}
