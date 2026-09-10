"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import { useLocale } from "./locale-context";
import {
  getMyPersonalData,
  updateMyPersonalDataAction,
  type MyPersonalData,
  type UpdateMyPersonalDataState,
} from "./personal-data-actions";
import styles from "./app-shell.module.css";

// Kept as local constants (not imported from @ponto-dcit/shared-types) —
// same reasoning as apps/web/src/app/(app)/colaboradores/colaborador-form-fields.tsx:
// avoids pulling that package's full CommonJS barrel into the client bundle
// for two `as const` arrays. Must stay in sync with
// packages/shared-types/src/employee-create.ts.
const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "uniao_estavel",
] as const;
const ESTADO_CIVIL_LABELS: Record<(typeof ESTADOS_CIVIS)[number], string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União estável",
};

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

const initialState: UpdateMyPersonalDataState = { error: null, success: false };

export function PersonalDataDialog() {
  const [data, setData] = useState<MyPersonalData | null>(null);
  // Tracks whether the fetch has settled, separately from `data` itself —
  // a colaborador with no personal data yet still resolves to `data: null`,
  // and the form must still be allowed to render in that case.
  const [loaded, setLoaded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ruaRef = useRef<HTMLInputElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const cidadeRef = useRef<HTMLInputElement>(null);
  const estadoRef = useRef<HTMLSelectElement>(null);
  const [state, formAction, pending] = useActionState(
    updateMyPersonalDataAction,
    initialState,
  );
  const { t } = useLocale();

  useEffect(() => {
    getMyPersonalData()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  // Same ViaCEP autofill as colaborador-form-fields.tsx's handleCepBlur,
  // minus the "skip if CEP unchanged" guard — that guard exists there to
  // protect a gestor/rh edit dialog reused for both create and edit; here
  // there's only ever one save action, so always refetching on blur is fine.
  async function handleCepBlur(event: FocusEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return;
      const cep: ViaCepResponse = await res.json();
      if (cep.erro) return;
      if (ruaRef.current && cep.logradouro)
        ruaRef.current.value = cep.logradouro;
      if (bairroRef.current && cep.bairro) bairroRef.current.value = cep.bairro;
      if (cidadeRef.current && cep.localidade)
        cidadeRef.current.value = cep.localidade;
      if (estadoRef.current && cep.uf) estadoRef.current.value = cep.uf;
    } catch {
      // Network failure: leave the address fields exactly as the user left them.
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.userMenuItem}
        onClick={() => dialogRef.current?.showModal()}
      >
        {t("Meu Perfil")}
      </button>
      <dialog
        ref={dialogRef}
        className={styles.personalDataDialog}
        onClick={onDialogClick}
      >
        <span className={styles.avatarDialogTitle}>{t("Meu Perfil")}</span>
        {state.success ? (
          <p className={styles.passwordSuccess}>
            {t("Dados salvos com sucesso.")}
          </p>
        ) : null}
        {state.error ? (
          <p className={styles.passwordError}>{t(state.error)}</p>
        ) : null}
        {loaded ? (
          <form action={formAction} className={styles.personalDataForm}>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>{t("RG")}</span>
              <input
                type="text"
                name="rg"
                defaultValue={data?.rg ?? ""}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>
                {t("Data de nascimento")}
              </span>
              <input
                type="date"
                name="dataNascimento"
                defaultValue={data?.dataNascimento ?? ""}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>
                {t("Estado civil")}
              </span>
              <select
                name="estadoCivil"
                defaultValue={data?.estadoCivil ?? ""}
                className={styles.personalDataSelect}
              >
                <option value="">—</option>
                {ESTADOS_CIVIS.map((value) => (
                  <option key={value} value={value}>
                    {t(ESTADO_CIVIL_LABELS[value])}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>{t("Telefone")}</span>
              <input
                type="text"
                name="phone"
                placeholder="11987654321"
                pattern="\d{10,11}"
                title="10 ou 11 dígitos, sem pontuação"
                defaultValue={data?.phone ?? ""}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>{t("CEP")}</span>
              <input
                type="text"
                name="enderecoCep"
                placeholder="8 dígitos"
                pattern="\d{8}"
                title="CEP deve ter exatamente 8 dígitos, sem hífen"
                defaultValue={data?.enderecoCep ?? ""}
                onBlur={handleCepBlur}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>{t("Rua")}</span>
              <input
                ref={ruaRef}
                type="text"
                name="enderecoRua"
                defaultValue={data?.enderecoRua ?? ""}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>{t("Número")}</span>
              <input
                type="text"
                name="enderecoNumero"
                defaultValue={data?.enderecoNumero ?? ""}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>{t("Bairro")}</span>
              <input
                ref={bairroRef}
                type="text"
                name="enderecoBairro"
                defaultValue={data?.enderecoBairro ?? ""}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>{t("Cidade")}</span>
              <input
                ref={cidadeRef}
                type="text"
                name="enderecoCidade"
                defaultValue={data?.enderecoCidade ?? ""}
                className={styles.personalDataInput}
              />
            </label>
            <label className={styles.personalDataField}>
              <span className={styles.personalDataLabel}>
                {t("Estado (UF)")}
              </span>
              <select
                ref={estadoRef}
                name="enderecoEstado"
                defaultValue={data?.enderecoEstado ?? ""}
                className={styles.personalDataSelect}
              >
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className={styles.personalDataSubmit}
              disabled={pending}
            >
              {pending ? t("Salvando...") : t("Salvar")}
            </button>
          </form>
        ) : null}
        <button
          type="button"
          className={styles.avatarDialogClose}
          onClick={() => dialogRef.current?.close()}
        >
          {t("Fechar")}
        </button>
      </dialog>
    </>
  );
}
