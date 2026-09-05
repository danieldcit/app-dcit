"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { NAV_SECTIONS, type NavRole } from "@/lib/nav-sections";

import styles from "./app-shell.module.css";

const DIACRITICS_PATTERN = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase();
}

export function SearchOverlay({ role }: { role: NavRole }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return [];
    return NAV_SECTIONS.filter(
      (section) => section.roles.includes(role) && normalize(section.label).includes(needle),
    );
  }, [query, role]);

  function open() {
    setQuery("");
    dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    dialogRef.current?.close();
    router.push(href);
  }

  // <dialog>'s own backdrop swallows clicks by default — a click "outside"
  // still lands on the dialog element itself (the backdrop is part of it),
  // just outside its content box. Only close when the click target is the
  // dialog element, never a descendant, so clicking the input/results
  // doesn't dismiss it.
  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  return (
    <>
      <button type="button" className={styles.searchButton} onClick={open}>
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Buscar
        <kbd className={styles.searchShortcut}>Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.searchDialog}
        onClose={() => setQuery("")}
        onClick={onDialogClick}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar telas..."
          className={styles.searchInput}
        />
        <ul className={styles.searchResults}>
          {results.map((section) => (
            <li key={section.href}>
              <button
                type="button"
                className={styles.searchResultItem}
                onClick={() => go(section.href)}
              >
                {section.label}
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 ? (
            <li className={styles.searchEmpty}>Nada encontrado para &quot;{query}&quot;.</li>
          ) : null}
        </ul>
      </dialog>
    </>
  );
}
