"use client";

import { useActionState, useEffect, useRef } from "react";

import { createEmployee } from "./actions";
import { ColaboradorFormFields, type ColaboradorFormDefaults } from "./colaborador-form-fields";
import styles from "./colaboradores.module.css";

const EMPTY_DEFAULTS: ColaboradorFormDefaults = {
  name: "",
  role: "colaborador",
  email: null,
  cargo: null,
  team: null,
  nivel: null,
  convencaoId: null,
  salarioMensal: null,
  hireDate: "",
  cpf: null,
  rg: null,
  dataNascimento: null,
  estadoCivil: null,
  enderecoRua: null,
  enderecoNumero: null,
  enderecoBairro: null,
  enderecoCidade: null,
  enderecoEstado: null,
  enderecoCep: null,
};

export function NovoColaboradorDialog({ convencoes }: { convencoes: { id: string; nome: string }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createEmployee, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
    }
    // successToken (not state.success) is the intentional dependency:
    // state.success alone stays `true` (Object.is-equal) from the 2nd
    // successful submit onward and would never re-trigger this effect,
    // leaving the dialog open on repeat creates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successToken]);

  return (
    <>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        + Novo colaborador
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Novo colaborador</p>
        <form ref={formRef} action={formAction}>
          <ColaboradorFormFields
            defaults={EMPTY_DEFAULTS}
            convencoes={convencoes}
            showConvencao={false}
          />
          {state.error ? <span className={styles.error}>{state.error}</span> : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => {
                dialogRef.current?.close();
                formRef.current?.reset();
              }}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.saveButton} disabled={pending}>
              Cadastrar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
