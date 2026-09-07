// Row grouping and captions come straight from the source photos' filenames
// (which already are each person's title) and the row breaks the user
// specified directly — not derived from any org-chart data, since none
// exists in this codebase yet.
export type TeamMember = { title: string; image: string };

export const TEAM_ROWS: TeamMember[][] = [
  [
    { title: "Founder e CEO na DCIT", image: "/team/founder-ceo.jpg" },
    { title: "IT Analyst - Cloud Architecture", image: "/team/it-analyst-cloud-architecture.jpg" },
    { title: "DataCenter & Cloud Analist", image: "/team/datacenter-cloud-analist.jpg" },
  ],
  [
    { title: "Gerente de TI", image: "/team/gerente-de-ti.jpg" },
    { title: "Gerente Comercial", image: "/team/gerente-comercial.jpg" },
  ],
  [{ title: "Especialista Azure Cloud", image: "/team/especialista-azure-cloud.jpg" }],
  [{ title: "Full Stack Developer", image: "/team/full-stack-developer.jpg" }],
  [
    { title: "Cybersecurity Analyst", image: "/team/cybersecurity-analyst.jpg" },
    { title: "Analista Microsoft 365", image: "/team/analista-microsoft-365.jpg" },
    { title: "Analista de Cloud", image: "/team/analista-de-cloud-1.jpg" },
    { title: "Analista de Cloud", image: "/team/analista-de-cloud-2.jpg" },
    { title: "Analista Cloud & Ops", image: "/team/analista-cloud-ops.jpg" },
    { title: "Analista 365", image: "/team/analista-365.jpg" },
    { title: "Analista de Cloud", image: "/team/analista-de-cloud-3.jpg" },
  ],
];
