// Fixed set of access items a colaborador needs configured — not
// user-defined, so a closed enum instead of free text. Same convention as
// ADMISSION_DOCUMENT_KINDS (packages/shared-types/src/documentos.ts): adding
// a 6th item later means adding it here and to the labels map.
export const ONBOARDING_ACCESS_ITEMS = [
  "sgn_portal",
  "movidesk",
  "email_corporativo",
  "teams",
  "site24x7",
] as const;
export type OnboardingAccessItem = (typeof ONBOARDING_ACCESS_ITEMS)[number];

export const ONBOARDING_ACCESS_ITEM_LABELS: Record<OnboardingAccessItem, string> = {
  sgn_portal: "SGN Portal",
  movidesk: "Movidesk",
  email_corporativo: "Email corporativo",
  teams: "Teams",
  site24x7: "Site24x7",
};
