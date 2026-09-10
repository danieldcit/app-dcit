"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { Locale } from "@/lib/locale";
import { translate } from "@/translations/dictionaries";

import { setLocaleAction } from "./locale-actions";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (source: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);

  // The cookie is the source of truth (set via the server action below,
  // which also revalidates the layout) — this keeps client state in sync
  // whenever a fresh server render supplies a different initialLocale.
  // Deferred via queueMicrotask, not called synchronously in the effect
  // body — react-hooks/set-state-in-effect flags direct setState calls
  // there, same as meu-ponto-card.tsx's geolocation fallback.
  useEffect(() => {
    queueMicrotask(() => setLocaleState(initialLocale));
  }, [initialLocale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    void setLocaleAction(next);
  }

  function t(source: string): string {
    return translate(locale, source);
  }

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return value;
}
