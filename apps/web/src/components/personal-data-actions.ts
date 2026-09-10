"use server";

import { apiFetch } from "@/lib/api";

export type MyPersonalData = {
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
  phone: string | null;
};

export async function getMyPersonalData(): Promise<MyPersonalData | null> {
  const res = await apiFetch("/employees/me/personal-data");
  if (!res.ok) return null;
  return (await res.json()) as MyPersonalData;
}

const PERSONAL_DATA_FIELDS = [
  "rg",
  "dataNascimento",
  "estadoCivil",
  "enderecoRua",
  "enderecoNumero",
  "enderecoBairro",
  "enderecoCidade",
  "enderecoEstado",
  "enderecoCep",
  "phone",
] as const;

export type UpdateMyPersonalDataState = { error: string | null; success: boolean };

export async function updateMyPersonalDataAction(
  _prevState: UpdateMyPersonalDataState,
  formData: FormData,
): Promise<UpdateMyPersonalDataState> {
  const payload: Record<string, string | null> = {};
  for (const field of PERSONAL_DATA_FIELDS) {
    const value = formData.get(field);
    payload[field] = typeof value === "string" && value !== "" ? value : null;
  }

  const res = await apiFetch("/employees/me/personal-data", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { error: `Não foi possível salvar (código ${res.status}).`, success: false };
  }

  return { error: null, success: true };
}
