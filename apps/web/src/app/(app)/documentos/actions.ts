"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function getAtestadoPhoto(id: string): Promise<string | null> {
  const res = await apiFetch(`/atestados/${id}/photo`);
  if (!res.ok) {
    throw new Error(`/atestados/${id}/photo responded with ${res.status}`);
  }
  const data = (await res.json()) as { photoDataUrl: string | null };
  return data.photoDataUrl;
}

export async function updateAtestadoStatus(
  id: string,
  status: "em_analise" | "aprovado" | "recusado",
  reviewNote?: string,
) {
  const res = await apiFetch(`/atestados/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reviewNote }),
  });
  if (!res.ok) {
    throw new Error(`/atestados/${id}/status responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}

export async function getAdmissionDocumentPhotos(id: string): Promise<string[]> {
  const res = await apiFetch(`/documentos/admissionais/${id}/photos`);
  if (!res.ok) {
    throw new Error(`/documentos/admissionais/${id}/photos responded with ${res.status}`);
  }
  const data = (await res.json()) as { photos: string[] };
  return data.photos;
}

export async function updateAdmissionDocumentStatus(
  id: string,
  status: "em_analise" | "aprovado" | "recusado",
  reviewNote?: string,
) {
  const res = await apiFetch(`/documentos/admissionais/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reviewNote }),
  });
  if (!res.ok) {
    throw new Error(`/documentos/admissionais/${id}/status responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}

export async function submitCertification(formData: FormData) {
  const name = formData.get("name");
  const institution = formData.get("institution");
  const validUntil = formData.get("validUntil");
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof institution !== "string" ||
    institution.trim().length === 0 ||
    typeof validUntil !== "string" ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(validUntil)
  ) {
    throw new Error("Preencha nome, instituição e uma data válida (DD/MM/AAAA).");
  }
  const res = await apiFetch("/documentos/certificacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), institution: institution.trim(), validUntil }),
  });
  if (!res.ok) {
    throw new Error(`/documentos/certificacoes responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}
