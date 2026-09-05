"use client";

import { useActionState, useEffect, useRef } from "react";

import { updateEmployeePersonalData } from "./actions";
import { ColaboradorFormFields, type ColaboradorFormDefaults } from "./colaborador-form-fields";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  role: "colaborador" | "gestor" | "rh";
  email: string | null;
  cargo: string | null;
  team: string | null;
  nivel: string | null;
  convencaoId: string | null;
  salarioMensal: number | null;
  hireDate: string;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

export function EditarColaboradorDialog({
  employee,
  convencoes,
}: {
  employee: Employee;
  convencoes: { id: string; nome: string }[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(updateEmployeePersonalData, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      // Deliberately not resetting the form here: this dialog keeps a stable
      // React key across the save (no remount), so `defaultValue` never
      // re-applies from a fresh `employee` prop — a reset would revert every
      // field to its pre-edit, mount-time value instead of the just-saved
      // one. Leaving the uncontrolled inputs alone means they keep exactly
      // what the user typed, which is what was just persisted, so a later
      // reopen shows the correct (current) data.
    }
    // successToken (not state.success) is the intentional dependency: see
    // novo-colaborador-dialog.tsx for why plain `success: true` would never
    // re-trigger this effect on a 2nd+ successful save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successToken]);

  const defaults: ColaboradorFormDefaults = {
    name: employee.name,
    role: employee.role ?? "colaborador",
    email: employee.email ?? null,
    cargo: employee.cargo ?? null,
    team: employee.team ?? null,
    nivel: employee.nivel ?? null,
    convencaoId: employee.convencaoId ?? null,
    salarioMensal: employee.salarioMensal ?? null,
    hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : "",
    cpf: employee.cpf ?? null,
    rg: employee.rg ?? null,
    dataNascimento: employee.dataNascimento ? employee.dataNascimento.slice(0, 10) : null,
    estadoCivil: employee.estadoCivil ?? null,
    enderecoRua: employee.enderecoRua ?? null,
    enderecoNumero: employee.enderecoNumero ?? null,
    enderecoBairro: employee.enderecoBairro ?? null,
    enderecoCidade: employee.enderecoCidade ?? null,
    enderecoEstado: employee.enderecoEstado ?? null,
    enderecoCep: employee.enderecoCep ?? null,
  };

  return (
    <>
      <button
        type="button"
        className={styles.saveButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        Editar
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Editar {employee.name}</p>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="userId" value={employee.userId} />
          <ColaboradorFormFields defaults={defaults} convencoes={convencoes} />
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
              Salvar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
