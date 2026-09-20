import { z } from "zod";

export const TipoContratacaoUpdateSchema = z.object({
  tipoContratacao: z.enum(["CLT", "PJ", "terceirizado"]).nullable(),
});
export type TipoContratacaoUpdate = z.infer<typeof TipoContratacaoUpdateSchema>;
