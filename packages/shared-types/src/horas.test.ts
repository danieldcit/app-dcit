import { PeriodoHorasSchema, TicketsEntryCreateSchema } from "./horas";

describe("PeriodoHorasSchema", () => {
  it("accepts dia, semana and mes", () => {
    expect(PeriodoHorasSchema.safeParse("dia").success).toBe(true);
    expect(PeriodoHorasSchema.safeParse("semana").success).toBe(true);
    expect(PeriodoHorasSchema.safeParse("mes").success).toBe(true);
  });

  it("rejects anything else", () => {
    expect(PeriodoHorasSchema.safeParse("ano").success).toBe(false);
    expect(PeriodoHorasSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("TicketsEntryCreateSchema", () => {
  it("accepts a valid lançamento", () => {
    const result = TicketsEntryCreateSchema.safeParse({
      userId: "user-1",
      date: "2026-09-03",
      horasTickets: 6.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-date-only date string", () => {
    const result = TicketsEntryCreateSchema.safeParse({
      userId: "user-1",
      date: "2026-09-03T10:00:00.000Z",
      horasTickets: 6,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative hours", () => {
    const result = TicketsEntryCreateSchema.safeParse({
      userId: "user-1",
      date: "2026-09-03",
      horasTickets: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty userId", () => {
    const result = TicketsEntryCreateSchema.safeParse({
      userId: "",
      date: "2026-09-03",
      horasTickets: 1,
    });
    expect(result.success).toBe(false);
  });
});
