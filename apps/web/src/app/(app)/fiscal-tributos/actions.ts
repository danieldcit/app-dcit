"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function classifyTipoContratacao(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  const tipoContratacao = formData.get("tipoContratacao");
  if (typeof userId !== "string" || typeof tipoContratacao !== "string") {
    throw new Error("Invalid form data");
  }

  const res = await apiFetch(`/employees/${userId}/tipo-contratacao`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipoContratacao }),
  });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/tipo-contratacao responded with ${res.status}`);
  }

  revalidatePath("/fiscal-tributos");
}

export type FiscalParametrosState = { error: string | null; success: boolean };

export async function saveFiscalParametros(
  _prevState: FiscalParametrosState,
  formData: FormData,
): Promise<FiscalParametrosState> {
  const inssPatronalPercent = formData.get("inssPatronalPercent");
  const ratPercent = formData.get("ratPercent");
  const terceirosPercent = formData.get("terceirosPercent");
  const fgtsPercent = formData.get("fgtsPercent");
  const fonteLegal = formData.get("fonteLegal");
  const vigenciaData = formData.get("vigenciaData");
  const sujeitoDesoneracaoFolha = formData.get("sujeitoDesoneracaoFolha") === "on";

  if (
    typeof inssPatronalPercent !== "string" ||
    typeof ratPercent !== "string" ||
    typeof terceirosPercent !== "string" ||
    typeof fgtsPercent !== "string"
  ) {
    return { error: "Dados do formulário inválidos.", success: false };
  }

  const payload = {
    inssPatronalPercent: inssPatronalPercent === "" ? null : inssPatronalPercent,
    ratPercent: ratPercent === "" ? null : ratPercent,
    terceirosPercent: terceirosPercent === "" ? null : terceirosPercent,
    fgtsPercent: fgtsPercent === "" ? null : fgtsPercent,
    sujeitoDesoneracaoFolha,
    fonteLegal: typeof fonteLegal === "string" && fonteLegal !== "" ? fonteLegal : null,
    vigenciaData: typeof vigenciaData === "string" && vigenciaData !== "" ? vigenciaData : null,
  };

  const res = await apiFetch("/fiscal/parametros", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { error: `Não foi possível salvar (código ${res.status}).`, success: false };
  }

  revalidatePath("/fiscal-tributos");
  revalidatePath("/fiscal-tributos/parametros");
  return { error: null, success: true };
}
