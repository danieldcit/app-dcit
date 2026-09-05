"use client";

import { useMemo, useState } from "react";

import { ColaboradoresRow } from "./colaboradores-row";
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

export function ColaboradoresList({
  employees,
  convencoes,
}: {
  employees: Employee[];
  convencoes: { id: string; nome: string }[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) => employee.name.toLowerCase().includes(normalized));
  }, [employees, query]);

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar colaborador pelo nome..."
        aria-label="Buscar colaborador pelo nome"
        className={styles.searchInput}
      />
      {filtered.length === 0 ? (
        <p className={styles.subheading}>Nenhum colaborador encontrado.</p>
      ) : (
        <ul className={styles.list}>
          {filtered.map((employee) => (
            <ColaboradoresRow key={employee.userId} employee={employee} convencoes={convencoes} />
          ))}
        </ul>
      )}
    </>
  );
}
