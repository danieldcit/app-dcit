"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { useLocale } from "./locale-context";
import styles from "./app-shell.module.css";

const EDIT_SIZE = 240; // px, tamanho do quadro de edição exibido na tela
const OUTPUT_SIZE = 480; // px, resolução do avatar exportado (2x o quadro, pra ficar nítido)
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function AvatarCropper({
  imageSrc,
  onConfirm,
  onCancel,
}: {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null);

  const baseScale = naturalSize ? Math.max(EDIT_SIZE / naturalSize.width, EDIT_SIZE / naturalSize.height) : 1;
  const displayScale = baseScale * zoom;
  const displayedWidth = naturalSize ? naturalSize.width * displayScale : EDIT_SIZE;
  const displayedHeight = naturalSize ? naturalSize.height * displayScale : EDIT_SIZE;
  const maxOffsetX = Math.max(0, (displayedWidth - EDIT_SIZE) / 2);
  const maxOffsetY = Math.max(0, (displayedHeight - EDIT_SIZE) / 2);

  // Reclampa a posição sempre que o zoom mudar — sem isso, dar zoom out
  // depois de ter arrastado no zoom máximo deixaria a imagem "fora do
  // quadro", com uma tarja vazia numa das bordas.
  useEffect(() => {
    setOffset((current) => ({
      x: clamp(current.x, -maxOffsetX, maxOffsetX),
      y: clamp(current.y, -maxOffsetY, maxOffsetY),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa re-clampar quando os limites mudam
  }, [maxOffsetX, maxOffsetY]);

  function handlePointerDown(event: ReactPointerEvent<HTMLImageElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, startOffset: offset };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLImageElement>) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setOffset({
      x: clamp(dragRef.current.startOffset.x + dx, -maxOffsetX, maxOffsetX),
      y: clamp(dragRef.current.startOffset.y + dy, -maxOffsetY, maxOffsetY),
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLImageElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img || !naturalSize) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = OUTPUT_SIZE / EDIT_SIZE;
    const drawWidth = displayedWidth * ratio;
    const drawHeight = displayedHeight * ratio;
    const drawX = OUTPUT_SIZE / 2 - drawWidth / 2 + offset.x * ratio;
    const drawY = OUTPUT_SIZE / 2 - drawHeight / 2 + offset.y * ratio;
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    onConfirm(canvas.toDataURL("image/jpeg", 0.9));
  }

  return (
    <div className={styles.avatarCropper}>
      <div className={styles.avatarCropViewport} style={{ width: EDIT_SIZE, height: EDIT_SIZE }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL sendo posicionada/recortada, não um asset remoto */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const el = event.currentTarget;
            setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={styles.avatarCropImage}
          style={{
            width: displayedWidth,
            height: displayedHeight,
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
          }}
        />
      </div>
      <input
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={(event) => setZoom(Number(event.target.value))}
        className={styles.avatarCropZoom}
        aria-label={t("Zoom")}
      />
      <div className={styles.avatarCropActions}>
        <button type="button" className={styles.avatarDialogClose} onClick={onCancel}>
          {t("Cancelar")}
        </button>
        <button type="button" className={styles.avatarCropConfirm} onClick={handleConfirm} disabled={!naturalSize}>
          {t("Salvar")}
        </button>
      </div>
    </div>
  );
}
