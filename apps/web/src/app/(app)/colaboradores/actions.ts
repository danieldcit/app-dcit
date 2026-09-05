"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

import { OPTIONAL_FIELDS } from "./employee-optional-fields";

export type UpdateScheduleState = { error: string | null };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function updateSchedule(
  _prevState: UpdateScheduleState,
  formData: FormData
): Promise<UpdateScheduleState> {
  const userId = formData.get("userId");
  const rawExpectedStartTime = formData.get("expectedStartTime");
  if (typeof userId !== "string" || typeof rawExpectedStartTime !== "string") {
    return { error: "Dados do formulário inválidos." };
  }

  const expectedStartTime = rawExpectedStartTime === "" ? null : rawExpectedStartTime;
  if (expectedStartTime !== null && !TIME_PATTERN.test(expectedStartTime)) {
    return { error: "Horário inválido. Use o formato HH:mm." };
  }

  const res = await apiFetch(`/employees/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedStartTime }),
  });
  if (!res.ok) {
    return { error: `Não foi possível salvar (código ${res.status}).` };
  }

  revalidatePath("/colaboradores");
  revalidatePath("/");
  return { error: null };
}

export type CreateEmployeeState = { error: string | null; success: boolean; successToken: number };

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const name = formData.get("name");
  const role = formData.get("role");
  const hireDate = formData.get("hireDate");
  if (typeof name !== "string" || typeof role !== "string" || typeof hireDate !== "string") {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const payload: Record<string, string | null> = { name, role, hireDate };
  for (const field of OPTIONAL_FIELDS) {
    const value = formData.get(field);
    payload[field] = typeof value === "string" && value !== "" ? value : null;
  }

  const res = await apiFetch("/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 409) {
      return {
        error: await conflictMessage(res),
        success: false,
        successToken: _prevState.successToken,
      };
    }
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/colaboradores");
  revalidatePath("/");
  // successToken changes on every successful submit (even repeats), so the
  // dialog's useEffect — which depends on it, not on `success` — reliably
  // fires again to close+reset the form each time (useActionState reuses
  // the last returned value, so plain `success: true` twice in a row would
  // be Object.is-equal and never re-trigger the effect after the 2nd save).
  return { error: null, success: true, successToken: Date.now() };
}

// The API's ConflictException carries a specific message distinguishing CPF
// vs email vs lixeira conflicts (see EmployeesService.uniqueConstraintMessage)
// — surface it as-is instead of guessing which field conflicted.
async function conflictMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
      return body.message;
    }
  } catch {
    // Fall through to the generic message below.
  }
  return "Já existe um colaborador cadastrado com esse CPF ou email.";
}

export async function deleteEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/employees/${userId} responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
  revalidatePath("/");
}

export async function restoreEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}/restore`, { method: "PATCH" });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/restore responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
  revalidatePath("/");
}

export async function updateEmployeePersonalData(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const userId = formData.get("userId");
  const name = formData.get("name");
  const role = formData.get("role");
  const hireDate = formData.get("hireDate");
  if (
    typeof userId !== "string" ||
    typeof name !== "string" ||
    typeof role !== "string" ||
    typeof hireDate !== "string"
  ) {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const payload: Record<string, string | null> = { name, role, hireDate };
  for (const field of OPTIONAL_FIELDS) {
    const value = formData.get(field);
    payload[field] = typeof value === "string" && value !== "" ? value : null;
  }

  const res = await apiFetch(`/employees/${userId}/personal-data`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 409) {
      return {
        error: await conflictMessage(res),
        success: false,
        successToken: _prevState.successToken,
      };
    }
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/colaboradores");
  revalidatePath("/");
  return { error: null, success: true, successToken: Date.now() };
}

export async function permanentlyDeleteEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}/permanent`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/permanent responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
}
