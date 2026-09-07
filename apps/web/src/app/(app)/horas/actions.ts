"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

// Duplicated from lancar-horas-form.tsx (this codebase's convention: small
// date helpers are duplicated per-file rather than shared). Bounds the
// submitted date to the current São Paulo calendar month server-side too,
// so a request that bypasses the HTML <input>'s min/max (devtools, a
// modified request, a non-browser client) is rejected with a clear error
// instead of silently creating a row that's invisible under every period
// view and has no id exposed anywhere to delete it via.
function todaySaoPauloDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function firstDayOfCurrentSaoPauloMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-01`;
}

export async function lancarHoras(formData: FormData) {
  const userId = formData.get("userId");
  const date = formData.get("date");
  const horasTicketsRaw = formData.get("horasTickets");

  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    typeof date !== "string" ||
    date.length === 0 ||
    typeof horasTicketsRaw !== "string"
  ) {
    throw new Error("Preencha colaborador, data e horas em tickets.");
  }

  const minDate = firstDayOfCurrentSaoPauloMonth();
  const maxDate = todaySaoPauloDateOnly();
  if (date < minDate || date > maxDate) {
    throw new Error(`Data deve estar entre ${minDate} e ${maxDate} (mês atual).`);
  }

  const horasTickets = Number(horasTicketsRaw);
  if (!Number.isFinite(horasTickets) || horasTickets < 0) {
    throw new Error("Horas em tickets deve ser um número maior ou igual a zero.");
  }

  const res = await apiFetch("/horas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, date, horasTickets }),
  });
  if (!res.ok) {
    throw new Error(`/horas responded with ${res.status}`);
  }
  revalidatePath("/horas");
}

export async function excluirLancamento(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/horas/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/horas/${id} responded with ${res.status}`);
  }
  revalidatePath("/horas");
}
