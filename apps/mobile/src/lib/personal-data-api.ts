import { API_URL } from "@/constants/api";

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

export async function fetchMyPersonalData(token: string): Promise<MyPersonalData | null> {
  try {
    const response = await authedFetch(token, "/employees/me/personal-data");
    if (!response.ok) return null;
    return (await response.json()) as MyPersonalData;
  } catch {
    return null;
  }
}

export async function updateMyPersonalData(
  token: string,
  input: MyPersonalData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authedFetch(token, "/employees/me/personal-data", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, message: data?.message ?? "Não foi possível salvar os dados." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível salvar. Verifique sua conexão." };
  }
}
