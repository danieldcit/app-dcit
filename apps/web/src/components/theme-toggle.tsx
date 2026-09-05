"use client";

import { useLayoutEffect, useState } from "react";

import styles from "./theme-toggle.module.css";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

export function ThemeToggle() {
  // Always starts "light", matching the server-rendered markup (app/layout.tsx
  // hardcodes data-theme="light" pre-hydration) — reading the DOM here instead
  // would pick up whatever the inline bootstrap script already applied (e.g.
  // "dark" from localStorage), producing a client-vs-server aria-pressed
  // mismatch on this very first render. The layout effect below corrects it
  // before paint.
  const [theme, setTheme] = useState<Theme>("light");

  // Sync from the actual applied/persisted theme after hydration, and
  // re-apply it after React's dev-mode Strict Mode remount (which clears
  // attributes the inline bootstrap script set on <html> before hydration).
  // Runs before paint, so there's no visible flash.
  useLayoutEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const current = stored === "light" || stored === "dark" ? stored : document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = current;
    setTheme(current);
  }, []);

  function handleToggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={handleToggleTheme}
      aria-label="Alterar tema"
      aria-pressed={theme === "dark"}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3a9 9 0 000 18z" fill="currentColor" />
      </svg>
    </button>
  );
}
