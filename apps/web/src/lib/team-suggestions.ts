// Fonte única das sugestões de time/equipe usadas no autocomplete (colaborador
// form) e no filtro de Equipe em Fiscal & Tributos. Time é texto livre (sem
// lista fixa no schema, ver comentário em schema.prisma) — isso é só a lista
// de sugestões via <datalist>, não uma validação.
export const TEAM_SUGGESTIONS = ["SG MONITOR", "SGN 360", "SGM365", "SGP PORTAL"] as const;
