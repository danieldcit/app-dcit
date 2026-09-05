import {
  ADMISSION_DOCUMENT_KINDS,
  ADMISSION_DOCUMENT_KIND_LABELS,
  ADMISSION_DOCUMENT_MAX_PHOTOS,
  type AdmissionDocumentInput,
  type AdmissionDocumentKind,
  type CertificationInput,
} from "@ponto-dcit/shared-types";

import { API_URL } from "@/constants/api";

export { ADMISSION_DOCUMENT_KINDS, ADMISSION_DOCUMENT_KIND_LABELS, ADMISSION_DOCUMENT_MAX_PHOTOS };
export type { AdmissionDocumentKind };

export type PayslipRecord = {
  id: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

export type AdmissionDocumentRecord = {
  id: string;
  kind: string | null;
  title: string;
  status: string;
  reviewNote: string | null;
  submittedAt: string;
};

export type CertificationRecord = {
  id: string;
  name: string;
  institution: string;
  validUntil: string;
  createdAt: string;
};

async function authedFetch(token: string, path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function fetchPayslips(token: string): Promise<PayslipRecord[] | null> {
  try {
    const response = await authedFetch(token, "/documentos/holerites");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as PayslipRecord[]) : null;
  } catch {
    return null;
  }
}

export async function fetchAdmissionDocuments(
  token: string,
): Promise<AdmissionDocumentRecord[] | null> {
  try {
    const response = await authedFetch(token, "/documentos/admissionais");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as AdmissionDocumentRecord[]) : null;
  } catch {
    return null;
  }
}

export async function submitAdmissionDocument(
  token: string,
  input: AdmissionDocumentInput,
): Promise<AdmissionDocumentRecord | null> {
  try {
    const response = await authedFetch(token, "/documentos/admissionais", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as AdmissionDocumentRecord;
  } catch {
    return null;
  }
}

export async function fetchCertifications(
  token: string,
): Promise<CertificationRecord[] | null> {
  try {
    const response = await authedFetch(token, "/documentos/certificacoes");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as CertificationRecord[]) : null;
  } catch {
    return null;
  }
}

export async function submitCertification(
  token: string,
  input: CertificationInput,
): Promise<CertificationRecord | null> {
  try {
    const response = await authedFetch(token, "/documentos/certificacoes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as CertificationRecord;
  } catch {
    return null;
  }
}
