import { z } from "zod";
import { documentStatusUpdateSchema } from "./status-update";
import { photoDataUrlSchema } from "./photo-data-url";

export const AtestadoInputSchema = z.object({
  cid: z.string().min(1),
  crm: z.string().min(1),
  medico: z.string().min(1),
  dias: z.number().int().positive(),
  photoDataUrl: photoDataUrlSchema(),
});
export type AtestadoInput = z.infer<typeof AtestadoInputSchema>;

export const AtestadoStatusUpdateSchema = documentStatusUpdateSchema();
export type AtestadoStatusUpdate = z.infer<typeof AtestadoStatusUpdateSchema>;
