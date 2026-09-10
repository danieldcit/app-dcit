"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";

import { useClickOutside } from "@/lib/use-click-outside";
import type { Session } from "@/lib/session";

import { changePasswordAction, type ChangePasswordState } from "./account-actions";
import { getMyAvatar, removeMyAvatar, updateMyAvatar } from "./avatar-actions";
import { LanguageSwitcher } from "./language-switcher";
import { useLocale } from "./locale-context";
import { PersonalDataDialog } from "./personal-data-dialog";
import styles from "./app-shell.module.css";

const initialChangePasswordState: ChangePasswordState = { error: null, success: false };

const ROLE_SOURCE_LABELS: Record<Session["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function UserIcon() {
  return (
    <svg className={styles.userIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path
        d="M4 20c0-4.418 3.582-7 8-7s8 2.582 8 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className={styles.pencilIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserMenu({
  user,
  logout,
}: {
  user: Session;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const passwordDialogRef = useRef<HTMLDialogElement>(null);
  const passwordFormRef = useRef<HTMLFormElement>(null);
  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    changePasswordAction,
    initialChangePasswordState,
  );
  const { t } = useLocale();

  useClickOutside(containerRef, () => setOpen(false), open);

  useEffect(() => {
    if (passwordState.success) passwordFormRef.current?.reset();
  }, [passwordState.success]);

  useEffect(() => {
    // Fetched once on mount rather than passed down from the layout — the
    // photo can be large (base64) and isn't needed on every server render,
    // just wherever this menu actually mounts.
    getMyAvatar()
      .then(setAvatar)
      .catch(() => {});
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !ACCEPTED_TYPES.includes(file.type)) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPending(true);
    try {
      await updateMyAvatar(dataUrl);
      setAvatar(dataUrl);
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    setPending(true);
    try {
      await removeMyAvatar();
      setAvatar(null);
    } finally {
      setPending(false);
    }
  }

  // Same reasoning as SearchOverlay's onDialogClick: <dialog>'s backdrop is
  // part of the element itself, so only a click landing on the dialog node
  // directly (never a descendant) means "outside the card".
  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  function onPasswordDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === passwordDialogRef.current) {
      passwordDialogRef.current?.close();
    }
  }

  return (
    <div className={styles.userMenu} ref={containerRef}>
      <button
        type="button"
        className={styles.userMenuButton}
        onClick={() => setOpen((current) => !current)}
        aria-label={t("Menu do usuário")}
        aria-expanded={open}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
          <img src={avatar} alt="" className={styles.avatarImage} />
        ) : (
          <UserIcon />
        )}
      </button>
      {open ? (
        <div className={styles.userMenuPanel}>
          <div className={styles.userMenuIdentity}>
            <div className={styles.avatarLargeWrap}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
                <img src={avatar} alt="" className={styles.avatarImageLarge} />
              ) : (
                <div className={styles.avatarPlaceholderLarge}>
                  <UserIcon />
                </div>
              )}
              <button
                type="button"
                className={styles.avatarEditBadge}
                aria-label={t("Editar foto")}
                onClick={() => dialogRef.current?.showModal()}
              >
                <PencilIcon />
              </button>
            </div>
            <span className={styles.identityName}>{user.name}</span>
            <span className={styles.identityRole}>{t(ROLE_SOURCE_LABELS[user.role])}</span>
          </div>

          <div className={styles.userMenuSection}>
            <PersonalDataDialog />
            <button
              type="button"
              className={styles.userMenuItem}
              onClick={() => passwordDialogRef.current?.showModal()}
            >
              {t("Alterar senha")}
            </button>
            <Link href="/ajuda" className={styles.userMenuItem} onClick={() => setOpen(false)}>
              {t("Central de Ajuda")}
            </Link>
          </div>

          <div className={styles.userMenuSection}>
            <LanguageSwitcher />
          </div>

          <div className={styles.userMenuFooter}>
            <form action={logout} className={styles.userMenuLogoutForm}>
              <button type="submit" className={styles.userMenuLogout}>
                {t("Sair")}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className={styles.avatarDialog}
        onClick={onDialogClick}
      >
        <div className={styles.avatarDialogHeader}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
            <img src={avatar} alt="" className={styles.avatarImageLarge} />
          ) : (
            <div className={styles.avatarPlaceholderLarge}>
              <UserIcon />
            </div>
          )}
          <span className={styles.avatarDialogTitle}>{t("Editar foto")}</span>
        </div>
        <label className={styles.avatarUploadLabel}>
          {pending ? t("Enviando...") : t("Trocar foto")}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleFileChange}
            disabled={pending}
            className={styles.avatarFileInput}
          />
        </label>
        {avatar ? (
          <button
            type="button"
            className={styles.avatarRemoveButton}
            onClick={handleRemove}
            disabled={pending}
          >
            {t("Remover foto")}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.avatarDialogClose}
          onClick={() => dialogRef.current?.close()}
        >
          {t("Fechar")}
        </button>
      </dialog>

      <dialog
        ref={passwordDialogRef}
        className={styles.avatarDialog}
        onClick={onPasswordDialogClick}
      >
        <span className={styles.avatarDialogTitle}>{t("Alterar senha")}</span>
        {passwordState.success ? (
          <p className={styles.passwordSuccess}>{t("Senha alterada com sucesso.")}</p>
        ) : null}
        {passwordState.error ? (
          <p className={styles.passwordError}>{t(passwordState.error)}</p>
        ) : null}
        <form ref={passwordFormRef} action={passwordFormAction} className={styles.passwordForm}>
          <input
            type="password"
            name="currentPassword"
            placeholder={t("Senha atual")}
            required
            className={styles.passwordInput}
          />
          <input
            type="password"
            name="newPassword"
            placeholder={t("Nova senha")}
            required
            minLength={8}
            className={styles.passwordInput}
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder={t("Confirmar nova senha")}
            required
            minLength={8}
            className={styles.passwordInput}
          />
          <button type="submit" className={styles.passwordSubmit} disabled={passwordPending}>
            {passwordPending ? t("Salvando...") : t("Salvar nova senha")}
          </button>
        </form>
        <button
          type="button"
          className={styles.avatarDialogClose}
          onClick={() => passwordDialogRef.current?.close()}
        >
          {t("Fechar")}
        </button>
      </dialog>
    </div>
  );
}
