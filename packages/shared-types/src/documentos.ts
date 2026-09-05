import { z } from "zod";
import { photoDataUrlSchema } from "./photo-data-url";
import { documentStatusUpdateSchema } from "./status-update";

// Fixed set of admission documents RH/gestor need from every colaborador —
// not user-defined categories, so a closed enum instead of free text. Adding
// a 6th kind later means adding it here (and to ADMISSION_DOCUMENT_KIND_LABELS
// + the API's 3 photo columns are already generic enough to not need touching).
export const ADMISSION_DOCUMENT_KINDS = [
  "rg",
  "cpf",
  "comprovante_endereco",
  "certidao_casamento",
  "certidao_nascimento_filhos",
] as const;
export type AdmissionDocumentKind = (typeof ADMISSION_DOCUMENT_KINDS)[number];

export const ADMISSION_DOCUMENT_KIND_LABELS: Record<AdmissionDocumentKind, string> = {
  rg: "RG",
  cpf: "CPF",
  comprovante_endereco: "Comprovante de endereço",
  certidao_casamento: "Certidão de casamento",
  certidao_nascimento_filhos: "Certidão de nascimento dos filhos",
};

export const ADMISSION_DOCUMENT_MAX_PHOTOS = 3;

export const AdmissionDocumentInputSchema = z.object({
  kind: z.enum(ADMISSION_DOCUMENT_KINDS),
  // 1 to 3 data: URLs — one submission per kind (see the API's upsert-by-
  // (userId, kind) behavior), resubmitting replaces the whole photo set.
  photos: z.array(photoDataUrlSchema()).min(1).max(ADMISSION_DOCUMENT_MAX_PHOTOS),
});
export type AdmissionDocumentInput = z.infer<typeof AdmissionDocumentInputSchema>;

// Same 3-state shape as AtestadoStatusUpdateSchema (em_analise/aprovado/
// recusado, recusado requires a reviewNote) — admissionais get the same
// gestor/RH decide flow.
export const AdmissionDocumentStatusUpdateSchema = documentStatusUpdateSchema();
export type AdmissionDocumentStatusUpdate = z.infer<typeof AdmissionDocumentStatusUpdateSchema>;

// The mobile form collects this as a plain "DD/MM/AAAA" text field, not a
// date picker — validate the shape here and let the service parse it.
const DATE_BR_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

export const CertificationInputSchema = z.object({
  name: z.string().min(1),
  institution: z.string().min(1),
  validUntil: z.string().regex(DATE_BR_PATTERN, "Use o formato DD/MM/AAAA"),
});
export type CertificationInput = z.infer<typeof CertificationInputSchema>;
