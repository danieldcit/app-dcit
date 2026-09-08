// Mirrors apps/web/src/app/(app)/onboarding/team-members.ts — same rows,
// same order, same names/titles; only the image source changes from a
// public-folder URL string to a bundled require().
//
// `image`'s type is intentionally left to inference rather than annotated
// as `ReturnType<typeof require>`: `require` is declared with an overloaded
// signature ((path: string) => any, plus a generic <T>(path: string) => T),
// and `ReturnType<...>` resolves against the last (generic) overload, which
// yields `unknown` with nothing to infer T from. Letting each require() call
// below infer against the first, non-generic overload instead gives `any`,
// which is what expo-image's <Image source> prop actually needs.
export const TEAM_ROWS = [
  [
    { name: "Claudio Medeiros", title: "Founder e CEO na DCIT", image: require("@/assets/images/team/founder-ceo.jpg") },
    {
      name: "Fabiano Peres",
      title: "IT Analyst - Cloud Architecture",
      image: require("@/assets/images/team/it-analyst-cloud-architecture.jpg"),
    },
    {
      name: "Marlisson Ferreira",
      title: "DataCenter & Cloud Analist",
      image: require("@/assets/images/team/datacenter-cloud-analist.jpg"),
    },
  ],
  [
    { name: "Everton Almeida", title: "Gerente de TI", image: require("@/assets/images/team/gerente-de-ti.jpg") },
    { name: "Nêmora Cristina", title: "Gerente Comercial", image: require("@/assets/images/team/gerente-comercial.jpg") },
  ],
  [
    {
      name: "Matheus Faria",
      title: "Especialista Azure Cloud",
      image: require("@/assets/images/team/especialista-azure-cloud.jpg"),
    },
  ],
  [
    {
      name: "Priscila Goulart",
      title: "Full Stack Developer",
      image: require("@/assets/images/team/full-stack-developer.jpg"),
    },
  ],
  [
    { name: "Adriano Filho", title: "Cybersecurity Analyst", image: require("@/assets/images/team/cybersecurity-analyst.jpg") },
    { name: "Rafael de miguel", title: "Analista Microsoft 365", image: require("@/assets/images/team/analista-microsoft-365.jpg") },
    { name: "Marconi Hastenreiter", title: "Analista de Cloud", image: require("@/assets/images/team/analista-de-cloud-1.jpg") },
    { name: "Arthur Benício", title: "Analista de Cloud", image: require("@/assets/images/team/analista-de-cloud-2.jpg") },
    { name: "Daniel Oliveira", title: "Analista Cloud & Ops", image: require("@/assets/images/team/analista-cloud-ops.jpg") },
    { name: "André Mariano", title: "Analista 365", image: require("@/assets/images/team/analista-365.jpg") },
    { name: "Diego Moreira", title: "Analista de Cloud", image: require("@/assets/images/team/analista-de-cloud-3.jpg") },
  ],
];

export type TeamMember = (typeof TEAM_ROWS)[number][number];
