"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import styles from "./documentos.module.css";

export type PickedPhoto = { dataUrl: string; base64: string; mediaType: string };

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PhotoUploadField({
  name,
  label,
  required,
  onPicked,
}: {
  name: string;
  label: string;
  required?: boolean;
  onPicked?: (photo: PickedPhoto) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(true);
      setPreview(null);
      if (hiddenInputRef.current) hiddenInputRef.current.value = "";
      return;
    }
    setError(false);
    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    setPreview(dataUrl);
    if (hiddenInputRef.current) hiddenInputRef.current.value = dataUrl;
    onPicked?.({ dataUrl, base64, mediaType: file.type });
  }

  return (
    <div className={styles.photoField}>
      <label htmlFor={`${name}-input`}>{label}</label>
      <input
        id={`${name}-input`}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleChange}
        required={required}
        className={styles.fileInput}
      />
      {error ? (
        <p className={styles.photoFieldError}>Formato não suportado — use JPEG, PNG ou WEBP.</p>
      ) : null}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
        <img src={preview} alt="Pré-visualização" className={styles.photoPreview} />
      ) : null}
      <input ref={hiddenInputRef} type="hidden" name={name} />
    </div>
  );
}
