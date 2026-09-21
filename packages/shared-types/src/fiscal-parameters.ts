import { z } from "zod";

export const FiscalParametersInputSchema = z.object({
  inssPatronalPercent: z.coerce.number().nonnegative().nullable(),
  ratPercent: z.coerce.number().min(1).max(3).nullable(),
  terceirosPercent: z.coerce.number().nonnegative().nullable(),
  fgtsPercent: z.coerce.number().nonnegative().nullable(),
  // Booleano de verdade, não z.coerce.boolean() — esse coage QUALQUER string
  // não-vazia (inclusive "false") para true. O caller converte o checkbox
  // para um boolean real antes de enviar.
  sujeitoDesoneracaoFolha: z.boolean().nullable(),
  fonteLegal: z.string().min(1).nullable(),
  vigenciaData: z.coerce.date().nullable(),
});
export type FiscalParametersInput = z.infer<typeof FiscalParametersInputSchema>;
