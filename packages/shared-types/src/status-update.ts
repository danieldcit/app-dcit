import { z } from "zod";

// Shared by every solicitação/atestado status-update schema: a rejection
// must always carry a justification, but an approval never needs one.
export function statusUpdateSchema() {
  return z
    .object({
      status: z.enum(["aprovado", "recusado"]),
      reviewNote: z.string().trim().min(1).optional(),
    })
    .refine((data) => data.status !== "recusado" || !!data.reviewNote, {
      message: "reviewNote is required when status is recusado",
      path: ["reviewNote"],
    });
}

// Documents (atestado, admissional) can also be moved back to "em_analise"
// explicitly — e.g. a gestor/RH undoing a decision from the photo viewer —
// unlike solicitações (férias/ajustes/compensações), which only ever go
// forward from pending to aprovado/recusado via statusUpdateSchema() above.
export function documentStatusUpdateSchema() {
  return z
    .object({
      status: z.enum(["em_analise", "aprovado", "recusado"]),
      reviewNote: z.string().trim().min(1).optional(),
    })
    .refine((data) => data.status !== "recusado" || !!data.reviewNote, {
      message: "reviewNote is required when status is recusado",
      path: ["reviewNote"],
    });
}
