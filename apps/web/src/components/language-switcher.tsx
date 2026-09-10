"use client";

import { useLocale } from "./locale-context";
import { LOCALES, LOCALE_LABELS } from "@/lib/locale";
import styles from "./app-shell.module.css";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={styles.languageSwitcher}>
      <span className={styles.languageSwitcherLabel}>{t("Idioma")}</span>
      <div className={styles.languageSwitcherOptions}>
        {LOCALES.map((value) => (
          <button
            key={value}
            type="button"
            className={
              value === locale
                ? `${styles.languageOption} ${styles.languageOptionActive}`
                : styles.languageOption
            }
            aria-pressed={value === locale}
            onClick={() => setLocale(value)}
          >
            {LOCALE_LABELS[value]}
          </button>
        ))}
      </div>
    </div>
  );
}
