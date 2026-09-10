import { z } from "zod";
import { ESTADOS_CIVIS, UFS } from "./employee-create";

// Self-service subset of EmployeeCreateSchema — only the personal/contact
// fields a colaborador may edit themselves. Everything contractual (name,
// role, cargo, team, nivel, convencaoId, salarioMensal, hireDate, cpf,
// email/login) stays gestor/rh-only via the existing
// PATCH /employees/:userId/personal-data endpoint.
export const MyPersonalDataUpdateSchema = z.object({
  rg: z.string().min(1).nullable(),
  dataNascimento: z.string().date().nullable(),
  estadoCivil: z.enum(ESTADOS_CIVIS).nullable(),
  enderecoRua: z.string().min(1).nullable(),
  enderecoNumero: z.string().min(1).nullable(),
  enderecoBairro: z.string().min(1).nullable(),
  enderecoCidade: z.string().min(1).nullable(),
  enderecoEstado: z.enum(UFS).nullable(),
  enderecoCep: z.string().regex(/^\d{8}$/).nullable(),
  // Never previously editable anywhere — see design notes. 10 or 11 digits
  // (area code + fixed or mobile number), digits only, same convention as
  // cpf/enderecoCep above.
  phone: z.string().regex(/^\d{10,11}$/).nullable(),
});
export type MyPersonalDataUpdateInput = z.infer<typeof MyPersonalDataUpdateSchema>;
