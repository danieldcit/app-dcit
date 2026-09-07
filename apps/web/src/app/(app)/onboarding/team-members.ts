// Row grouping and captions come straight from the source photos' filenames
// (which already are each person's title) and the row breaks the user
// specified directly — not derived from any org-chart data, since none
// exists in this codebase yet. Names added later, in the same photo order.
export type TeamMember = { name: string; title: string; image: string };

export const TEAM_ROWS: TeamMember[][] = [
  [
    { name: "Claudio Medeiros", title: "Founder e CEO na DCIT", image: "/team/founder-ceo.jpg" },
    {
      name: "Fabiano Peres",
      title: "IT Analyst - Cloud Architecture",
      image: "/team/it-analyst-cloud-architecture.jpg",
    },
    {
      name: "Marlisson Ferreira",
      title: "DataCenter & Cloud Analist",
      image: "/team/datacenter-cloud-analist.jpg",
    },
  ],
  [
    { name: "Everton Almeida", title: "Gerente de TI", image: "/team/gerente-de-ti.jpg" },
    { name: "Nêmora Cristina", title: "Gerente Comercial", image: "/team/gerente-comercial.jpg" },
  ],
  [{ name: "Matheus Faria", title: "Especialista Azure Cloud", image: "/team/especialista-azure-cloud.jpg" }],
  [{ name: "Priscila Goulart", title: "Full Stack Developer", image: "/team/full-stack-developer.jpg" }],
  [
    { name: "Adriano Filho", title: "Cybersecurity Analyst", image: "/team/cybersecurity-analyst.jpg" },
    { name: "Rafael de miguel", title: "Analista Microsoft 365", image: "/team/analista-microsoft-365.jpg" },
    { name: "Marconi Hastenreiter", title: "Analista de Cloud", image: "/team/analista-de-cloud-1.jpg" },
    { name: "Arthur Benício", title: "Analista de Cloud", image: "/team/analista-de-cloud-2.jpg" },
    { name: "Daniel Oliveira", title: "Analista Cloud & Ops", image: "/team/analista-cloud-ops.jpg" },
    { name: "André Mariano", title: "Analista 365", image: "/team/analista-365.jpg" },
    { name: "Diego Moreira", title: "Analista de Cloud", image: "/team/analista-de-cloud-3.jpg" },
  ],
];
