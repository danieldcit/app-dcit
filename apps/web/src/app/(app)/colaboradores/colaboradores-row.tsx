"use client";

import { useActionState, useRef } from "react";

import { deleteEmployee, updateSchedule } from "./actions";
import { EditarColaboradorDialog } from "./editar-colaborador-dialog";
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
  expectedStartTime: string | null;
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

export function ColaboradoresRow({
  employee,
  convencoes,
}: {
  employee: Employee;
  convencoes: { id: string; nome: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateSchedule, { error: null });
  const confirmDeleteRef = useRef<HTMLDialogElement>(null);

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>
        {employee.name}
      </span>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="userId" value={employee.userId} />
        <input
          type="time"
          name="expectedStartTime"
          defaultValue={employee.expectedStartTime ?? ""}
          aria-label={`Horário esperado de entrada de ${employee.name}`}
          className={styles.timeInput}
        />
        <button type="submit" className={styles.saveButton} disabled={pending}>
          Salvar
        </button>
      </form>
      <div className={styles.actions}>
        <EditarColaboradorDialog employee={employee} convencoes={convencoes} />
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => confirmDeleteRef.current?.showModal()}
        >
          Excluir
        </button>
      </div>
      {state.error ? <span className={styles.error}>{state.error}</span> : null}

      <dialog ref={confirmDeleteRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Excluir {employee.name}?</p>
        <p className={styles.subheading}>
          Ele irá para a lixeira e poderá ser restaurado depois.
        </p>
        <form action={deleteEmployee}>
          <input type="hidden" name="userId" value={employee.userId} />
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => confirmDeleteRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.deleteButton}>
              Excluir
            </button>
          </div>
        </form>
      </dialog>
    </li>
  );
}
