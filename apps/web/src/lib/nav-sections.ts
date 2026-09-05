export type NavRole = "colaborador" | "gestor" | "rh";

export type NavSection = {
  href: string;
  label: string;
  roles: NavRole[];
};

// roles mirrors each page's own session.role guard — kept here so search
// can filter results without duplicating that logic per page.
export const NAV_SECTIONS: NavSection[] = [
  { href: "/", label: "Ponto", roles: ["gestor", "rh", "colaborador"] },
  { href: "/historico", label: "Histórico de Pontos", roles: ["colaborador"] },
  { href: "/folha", label: "Folha de Ponto", roles: ["colaborador"] },
  { href: "/colaboradores", label: "Colaboradores", roles: ["gestor", "rh"] },
  { href: "/escala", label: "Plantão", roles: ["gestor", "rh"] },
  { href: "/aprovacoes", label: "Aprovações", roles: ["gestor", "rh"] },
  { href: "/documentos", label: "Documentos", roles: ["gestor", "rh", "colaborador"] },
  { href: "/mural", label: "Mural", roles: ["gestor", "rh", "colaborador"] },
  { href: "/beneficios", label: "Benefícios", roles: ["gestor", "rh"] },
  { href: "/pagamentos", label: "Pagamentos", roles: ["rh"] },
  { href: "/onboarding", label: "Onboarding", roles: ["gestor", "rh"] },
  { href: "/horas", label: "Horas", roles: ["gestor"] },
  { href: "/banco-de-horas", label: "Banco de Horas", roles: ["gestor", "rh", "colaborador"] },
  { href: "/ferias", label: "Férias", roles: ["colaborador"] },
  { href: "/holerites", label: "Holerites", roles: ["gestor", "rh"] },
  { href: "/notificacoes", label: "Notificações", roles: ["colaborador", "gestor", "rh"] },
];

// RH's sidebar shows the same items NAV_SECTIONS already grants it — this
// only controls their display order there (gestor's order and every role's
// search results are unaffected). Ponto, Banco de Horas, Holerites and
// Benefícios are excluded here — like for gestor, they render inside
// COLABORADORES_GROUP instead of this flat list.
export const RH_SIDEBAR_ORDER: string[] = [
  "/colaboradores",
  "/escala",
  "/aprovacoes",
  "/documentos",
  "/pagamentos",
  "/onboarding",
  "/notificacoes",
  "/mural",
];

export type SidebarLink = { href: string; label: string };
// A group's own row is itself a link (label + href) — clicking it navigates,
// like any other item. Its chevron independently expands/collapses
// `children`, which only ever show while expanded.
export type SidebarGroup = { href: string; label: string; children: SidebarLink[] };
export type SidebarEntry = SidebarLink | SidebarGroup;

export function isSidebarGroup(entry: SidebarEntry): entry is SidebarGroup {
  return "children" in entry;
}

// The colaborador sidebar is curated and grouped, unlike NAV_SECTIONS above
// (which stays flat — gestor/rh's sidebar, and every role's search results,
// are unaffected by this). Entries here only exist once their page does;
// each is added by its own sub-project as it ships (Ajustar Meu Ponto,
// Solicitações de Ajuste land inside the "Ponto" group; Banco de Horas,
// Férias, Documentos, Mural join as their own top-level entries —
// decided in conversation, mirroring the mobile app's tab structure).
export const COLABORADOR_SIDEBAR: SidebarEntry[] = [
  {
    href: "/",
    // "Colaborador" here only — the shared NAV_SECTIONS label ("Ponto", used
    // by search and by this same group nested under gestor/rh's
    // Colaboradores) is untouched, by explicit request.
    label: "Colaborador",
    children: [
      { href: "/historico", label: "Histórico de Pontos" },
      { href: "/folha", label: "Folha de Ponto" },
      { href: "/holerites", label: "Holerites" },
    ],
  },
  { href: "/banco-de-horas", label: "Banco de Horas" },
  { href: "/ferias", label: "Férias" },
  { href: "/documentos", label: "Documentos" },
  { href: "/mural", label: "Mural" },
  { href: "/notificacoes", label: "Notificações" },
];

// Shared by gestor and rh — Ponto, Banco de Horas, Holerites and Benefícios
// nest inside Colaboradores (same expand-to-reveal idiom as the colaborador
// sidebar's own Ponto group) so the top-level list stays short. The group's
// own row still links straight to /colaboradores, like any other item.
export const COLABORADORES_GROUP: SidebarGroup = {
  href: "/colaboradores",
  label: "Colaboradores",
  children: [
    { href: "/", label: "Ponto" },
    { href: "/banco-de-horas", label: "Banco de Horas" },
    { href: "/holerites", label: "Holerites" },
    { href: "/beneficios", label: "Benefícios" },
  ],
};

// The remaining gestor sidebar items, flat, in this curated order — the
// four above (Ponto, Banco de Horas, Holerites, Benefícios) and Colaboradores
// itself are excluded here since they render via COLABORADORES_GROUP instead.
export const GESTOR_SIDEBAR_ORDER: string[] = [
  "/escala",
  "/aprovacoes",
  "/documentos",
  "/onboarding",
  "/horas",
  "/notificacoes",
  "/mural",
];

// Gestor-only — deliberately not shared with rh (see the Gestão de Carreiras
// design spec: the original request was explicit that this is manager-only,
// unlike most other gestor+rh shared team screens in this app). A single
// flat link — the page has just one screen (Avaliação de Carreira), so no
// expandable group/children is needed.
export const GESTOR_CAREER_LINK: SidebarLink = {
  href: "/gestao-carreiras",
  label: "Gestão de Carreiras",
};
