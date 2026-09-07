import { z } from "zod";

export const PERIODOS_HORAS = ["dia", "semana", "mes"] as const;
export const PeriodoHorasSchema = z.enum(PERIODOS_HORAS);

// Horas Trabalhadas/Extras are derived from ponto (see HorasService.resumo/
// list) — the only thing a gestor can manually lançar here is ticket hours.
export const TicketsEntryCreateSchema = z.object({
  userId: z.string().min(1),
  date: z.string().date(),
  horasTickets: z.number().min(0),
});

export type PeriodoHoras = z.infer<typeof PeriodoHorasSchema>;
export type TicketsEntryCreateInput = z.infer<typeof TicketsEntryCreateSchema>;
