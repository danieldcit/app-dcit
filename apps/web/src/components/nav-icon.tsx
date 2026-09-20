import type { ReactNode } from "react";

// One glyph per NAV_SECTIONS/COLABORADOR_SIDEBAR/COLABORADORES_GROUP href,
// keyed by href so the same icon shows up everywhere that href appears
// (e.g. "/" in both the colaborador's own sidebar and nested inside the
// gestor/rh Colaboradores group). Same simple stroke style as the rest of
// the shell's hand-drawn icons (chevrons, bell, user) — no icon library.
const ICON_PATHS: Record<string, ReactNode> = {
  "/": (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "/historico": (
    <>
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/folha": (
    <>
      <path
        d="M6 3h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/colaboradores": (
    <>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.3" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 20c.2-2.4 1.7-4.3 3.8-4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/escala": (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/aprovacoes": (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "/documentos": (
    <>
      <path
        d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M15 2v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  "/mural": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="10" r="1.8" stroke="currentColor" strokeWidth="2" />
      <path d="M4 17l4.5-4.5 3.5 3.5 3-3 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "/beneficios": (
    <>
      <rect x="3" y="8" width="18" height="13" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M3 8h18M12 8v13" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8c-2-3-6-3-6-.5S9 8 12 8c3 0 6-1 6-3.5S14 5 12 8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  "/pagamentos": (
    <>
      <path
        d="M4 7a2 2 0 012-2h11a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M4 10h15" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="14" r="1.4" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  "/onboarding": (
    <>
      <path d="M6 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 4h12l-3 4 3 4H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  "/horas": (
    <>
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 9v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/banco-de-horas": (
    <>
      <path d="M3 10l9-6 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10v9M9 10v9M15 10v9M20 10v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/ferias": (
    <>
      <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v1.5M12 15v1.5M5 9h1.5M17.5 9H19M6.8 3.8l1 1M16.2 3.8l-1 1M6.8 14.2l1-1M16.2 14.2l-1-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M3 21c2-4 16-4 18 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/holerites": (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 9v.01M18.5 15v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/notificacoes": (
    <>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "/gestao-carreiras": (
    <>
      <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "/fiscal-tributos": (
    <>
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.5" cy="16.5" r="2.5" stroke="currentColor" strokeWidth="2" />
    </>
  ),
};

const DEFAULT_ICON: ReactNode = <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />;

export function NavIcon({ href, className }: { href: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {ICON_PATHS[href] ?? DEFAULT_ICON}
    </svg>
  );
}
