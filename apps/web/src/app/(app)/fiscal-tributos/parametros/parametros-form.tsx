"use client";

import { useActionState } from "react";

import { saveFiscalParametros, type FiscalParametrosState } from "../actions";
import type { FiscalParameters } from "./page";

const INITIAL_STATE: FiscalParametrosState = { error: null, success: false };

export function ParametrosForm({ parametros }: { parametros: FiscalParameters }) {
  const [state, formAction] = useActionState(saveFiscalParametros, INITIAL_STATE);

  return (
    <form action={formAction}>
      <label htmlFor="inssPatronalPercent">INSS patronal (%)</label>
      <input
        id="inssPatronalPercent"
        name="inssPatronalPercent"
        type="number"
        step="0.01"
        defaultValue={parametros?.inssPatronalPercent ?? ""}
      />

      <label htmlFor="ratPercent">RAT (%) — 1, 2 ou 3 conforme grau de risco</label>
      <input id="ratPercent" name="ratPercent" type="number" step="1" min="1" max="3" defaultValue={parametros?.ratPercent ?? ""} />

      <label htmlFor="fgtsPercent">FGTS (%)</label>
      <input id="fgtsPercent" name="fgtsPercent" type="number" step="0.01" defaultValue={parametros?.fgtsPercent ?? ""} />

      <label htmlFor="sujeitoDesoneracaoFolha">
        <input
          id="sujeitoDesoneracaoFolha"
          name="sujeitoDesoneracaoFolha"
          type="checkbox"
          defaultChecked={parametros?.sujeitoDesoneracaoFolha ?? false}
        />
        Empresa sujeita à transição da desoneração da folha (Lei 14.973/2024)
      </label>

      <label htmlFor="fonteLegal">Fonte legal / observações</label>
      <textarea id="fonteLegal" name="fonteLegal" defaultValue={parametros?.fonteLegal ?? ""} />

      <label htmlFor="vigenciaData">Vigência</label>
      <input
        id="vigenciaData"
        name="vigenciaData"
        type="date"
        defaultValue={parametros?.vigenciaData?.slice(0, 10) ?? ""}
      />

      <button type="submit">Salvar</button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p>Parâmetros salvos.</p> : null}
    </form>
  );
}
