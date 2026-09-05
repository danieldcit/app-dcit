"use client";

import { useRef, useState } from "react";

import { getAdmissionDocumentPhotos, updateAdmissionDocumentStatus } from "./actions";
import styles from "./documentos.module.css";

type PhotoStatus = "idle" | "loading" | "loaded" | "empty" | "error";
type DocStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

export function AdmissionDocumentPhotoButton({ id, status }: { id: string; status: DocStatus }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>("idle");
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentStatus, setCurrentStatus] = useState<DocStatus>(status);
  const [rejecting, setRejecting] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  async function open() {
    dialogRef.current?.showModal();
    setPhotoStatus("loading");
    try {
      const loaded = await getAdmissionDocumentPhotos(id);
      setPhotos(loaded);
      setPhotoStatus(loaded.length > 0 ? "loaded" : "empty");
    } catch {
      setPhotoStatus("error");
    }
  }

  async function decide(nextStatus: "em_analise" | "aprovado" | "recusado", note?: string) {
    setDeciding(true);
    try {
      await updateAdmissionDocumentStatus(id, nextStatus, note);
      setCurrentStatus(nextStatus);
      setRejecting(false);
      setReviewNote("");
    } finally {
      setDeciding(false);
    }
  }

  return (
    <>
      <button type="button" className={styles.photoButton} onClick={open}>
        Ver foto
      </button>

      <dialog ref={dialogRef} className={styles.photoDialog}>
        {photoStatus === "loading" ? <p>Carregando...</p> : null}
        {photoStatus === "loaded"
          ? photos.map((photoDataUrl, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
              <img
                key={index}
                src={photoDataUrl}
                alt={`Foto ${index + 1} do documento`}
                className={styles.photoImage}
              />
            ))
          : null}
        {photoStatus === "empty" ? <p>Este documento não possui foto anexada.</p> : null}
        {photoStatus === "error" ? <p>Não foi possível carregar a foto.</p> : null}

        {!rejecting ? (
          <div className={styles.decideRow}>
            <div className={styles.decideButtons}>
              <button
                type="button"
                className={
                  currentStatus === "em_analise" || currentStatus === "enviado"
                    ? `${styles.decideButton} ${styles.decideButtonActive}`
                    : styles.decideButton
                }
                disabled={deciding}
                onClick={() => decide("em_analise")}
              >
                Em Análise
              </button>
              <button
                type="button"
                className={
                  currentStatus === "aprovado"
                    ? `${styles.decideButton} ${styles.decideButtonActive}`
                    : styles.decideButton
                }
                disabled={deciding}
                onClick={() => decide("aprovado")}
              >
                Aprovado
              </button>
              <button
                type="button"
                className={
                  currentStatus === "recusado"
                    ? `${styles.decideButton} ${styles.decideButtonActive}`
                    : styles.decideButton
                }
                disabled={deciding}
                onClick={() => setRejecting(true)}
              >
                Reprovado
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.decideRow}>
            <label className={styles.dialogLabel} htmlFor={`reviewNote-admissional-${id}`}>
              Motivo da reprovação
            </label>
            <textarea
              id={`reviewNote-admissional-${id}`}
              className={styles.rejectTextarea}
              rows={3}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
            />
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogClose}
                onClick={() => setRejecting(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className={styles.submitButton}
                disabled={deciding || reviewNote.trim().length === 0}
                onClick={() => decide("recusado", reviewNote.trim())}
              >
                Confirmar reprovação
              </button>
            </div>
          </div>
        )}

        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={() => dialogRef.current?.close()}
          >
            Fechar
          </button>
        </div>
      </dialog>
    </>
  );
}
