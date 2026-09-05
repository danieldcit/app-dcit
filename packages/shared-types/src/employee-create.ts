import { z } from "zod";

import { RoleSchema } from "./role";

export const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "uniao_estavel",
] as const;

// As 27 UFs do Brasil — lista fixa, mesmo raciocínio de ESTADOS_CIVIS: evitar
// dado sujo ("ZZ" não deve ser um estado válido).
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

// Função (cargo técnico) do colaborador — lista fixa por enquanto, cresce
// conforme a empresa contrata para novas áreas.
export const CARGOS = [
  "rh",
  "analista_monitoramento",
  "analista_cloud_ops",
  "arquiteto_nuvem",
  "devops",
  "desenvolvedor",
  "analista_suporte",
  "engenheiro_dados",
  "dba",
  "analista_seguranca_informacao",
  "analista_qa",
  "analista_infraestrutura",
  "coordenador_ti",
] as const;

export const NIVEIS = ["junior", "pleno", "senior", "especialista"] as const;

export const EmployeeCreateSchema = z.object({
  name: z.string().min(1),
  role: RoleSchema,
  // Login por senha: quando presente, o colaborador ganha uma senha padrão
  // de desenvolvimento (ver DEV_PASSWORD em employees.service.ts) — ainda
  // não há fluxo de convite/definição de senha própria.
  email: z.string().email().nullable(),
  cargo: z.enum(CARGOS).nullable(),
  team: z.string().min(1).nullable(),
  nivel: z.enum(NIVEIS).nullable(),
  convencaoId: z.string().nullable(),
  // z.coerce.number() (não z.number()): o formulário de colaborador
  // reaproveita o mesmo array OPTIONAL_FIELDS que já monta o payload como
  // string a partir de FormData (apps/web/src/app/(app)/colaboradores/actions.ts)
  // — sem coerção, um salário "5000.50" (string) falharia a validação de
  // z.number(). nullable() intercepta null antes de tentar coagir, então o
  // caso "campo vazio" continua funcionando normalmente.
  salarioMensal: z.coerce.number().nonnegative().nullable(),
  hireDate: z.string().date(),
  cpf: z.string().regex(/^\d{11}$/).nullable(),
  rg: z.string().min(1).nullable(),
  dataNascimento: z.string().date().nullable(),
  estadoCivil: z.enum(ESTADOS_CIVIS).nullable(),
  enderecoRua: z.string().min(1).nullable(),
  enderecoNumero: z.string().min(1).nullable(),
  enderecoBairro: z.string().min(1).nullable(),
  enderecoCidade: z.string().min(1).nullable(),
  enderecoEstado: z.enum(UFS).nullable(),
  enderecoCep: z.string().regex(/^\d{8}$/).nullable(),
});
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>;
