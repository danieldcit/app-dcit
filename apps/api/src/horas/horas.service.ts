import { Injectable } from '@nestjs/common';
import type { PeriodoHoras, TicketsEntryCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { BancoDeHorasService, type BancoDeHorasDay } from '../banco-de-horas/banco-de-horas.service';
import { todaySaoPauloDateOnly } from '../common/sao-paulo-time';

// Parses an already-resolved "YYYY-MM-DD" as UTC midnight directly — never
// re-runs it through a São-Paulo conversion function a second time. That
// double-shift is the exact bug class documented in the Ponto Perdido
// sub-project (see apps/api/src/ponto-perdido — a symbolic UTC-midnight date
// run through dateOnlyInSaoPaulo again subtracts a day it shouldn't).
function mondayOfWeek(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  const day = date.getUTCDay(); // 0=Sunday..6=Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

function sundayOfWeek(dateOnly: string): string {
  const monday = new Date(`${mondayOfWeek(dateOnly)}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + 6);
  return monday.toISOString().slice(0, 10);
}

function firstDayOfMonth(dateOnly: string): string {
  return `${dateOnly.slice(0, 7)}-01`;
}

function lastDayOfMonth(dateOnly: string): string {
  const [year, month] = dateOnly.split('-').map(Number);
  // Day 0 of the next month is the last day of this month — a standard
  // Date trick, safe here because everything stays in UTC.
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

export function resolvePeriodoRange(periodo: PeriodoHoras, today: string): { start: string; end: string } {
  if (periodo === 'dia') return { start: today, end: today };
  if (periodo === 'semana') return { start: mondayOfWeek(today), end: sundayOfWeek(today) };
  return { start: firstDayOfMonth(today), end: lastDayOfMonth(today) };
}

export function sumTicketsByUser(entries: { userId: string; horasTickets: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.horasTickets);
  }
  return totals;
}

// Splits a ponto day into the portion that counts toward the mandatory
// workload ("Horas Trabalhadas", capped at what was expected that day) and
// the portion beyond it ("Horas Extras"). A day with no punches or below
// expectedMinutes contributes 0 to extras, never a negative number — a
// shortfall is a separate concern (see Banco de Horas' balanceMinutes),
// not something the Horas page tracks.
export function splitPontoMinutes(days: BancoDeHorasDay[]): { trabalhadasMinutes: number; extrasMinutes: number } {
  let trabalhadasMinutes = 0;
  let extrasMinutes = 0;
  for (const day of days) {
    trabalhadasMinutes += Math.min(day.workedMinutes, day.expectedMinutes);
    extrasMinutes += Math.max(0, day.workedMinutes - day.expectedMinutes);
  }
  return { trabalhadasMinutes, extrasMinutes };
}

// Ponto minutes land on quarter-hour boundaries in practice, but summing
// several days of them in floating-point minutes/60 can still leave noise
// like 7.999999999999999 — round to 2 decimals for display.
function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

@Injectable()
export class HorasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bancoDeHoras: BancoDeHorasService,
  ) {}

  lancar(input: TicketsEntryCreateInput, gestorId: string) {
    const date = new Date(`${input.date}T00:00:00.000Z`);
    return this.prisma.workedHoursEntry.upsert({
      where: { userId_date: { userId: input.userId, date } },
      create: {
        userId: input.userId,
        gestorId,
        date,
        horasTickets: input.horasTickets,
      },
      update: {
        gestorId,
        horasTickets: input.horasTickets,
      },
    });
  }

  // Horas Trabalhadas/Extras come from real ponto data (via BancoDeHorasService,
  // one getSummary call per employee — same batching tradeoff getTeamSummary
  // already makes: an extra query per person is cheap at this app's scale).
  // Horas Tickets stays a plain sum over the manually-lançado rows in range.
  async resumo(periodo: PeriodoHoras) {
    const today = todaySaoPauloDateOnly();
    const { start, end } = resolvePeriodoRange(periodo, today);
    const rangeStart = new Date(`${start}T00:00:00.000Z`);
    const rangeEnd = new Date(`${end}T23:59:59.999Z`);

    const [employees, ticketEntries] = await Promise.all([
      this.prisma.employee.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      this.prisma.workedHoursEntry.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
      }),
    ]);
    const ticketTotals = sumTicketsByUser(ticketEntries);

    return Promise.all(
      employees.map(async (employee) => {
        const summary = await this.bancoDeHoras.getSummary(employee.userId, start, end);
        const { trabalhadasMinutes, extrasMinutes } = splitPontoMinutes(summary.days);
        return {
          userId: employee.userId,
          name: employee.name,
          horasTrabalhadas: minutesToHours(trabalhadasMinutes),
          horasExtras: minutesToHours(extrasMinutes),
          horasTickets: ticketTotals.get(employee.userId) ?? 0,
        };
      }),
    );
  }

  // One row per day in the period (Horas Trabalhadas/Extras always present,
  // from ponto), with Horas Tickets merged in from WorkedHoursEntry when a
  // manual lançamento exists for that date. Days with nothing at all (no
  // ponto activity and no manual ticket entry) are dropped — otherwise every
  // weekend and every day before the employee was hired would show up as a
  // 0/0/0 row. ticketEntryId is null unless a manual row exists for that
  // day — the delete button in the UI only ever removes a manual ticket
  // lançamento, never ponto-derived numbers.
  async list(userId: string, periodo: PeriodoHoras) {
    const today = todaySaoPauloDateOnly();
    const { start, end } = resolvePeriodoRange(periodo, today);

    const [summary, ticketEntries] = await Promise.all([
      this.bancoDeHoras.getSummary(userId, start, end),
      this.prisma.workedHoursEntry.findMany({
        where: {
          userId,
          date: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
        },
      }),
    ]);
    const ticketsByDate = new Map(ticketEntries.map((entry) => [entry.date.toISOString().slice(0, 10), entry]));

    return summary.days
      .map((day) => {
        const trabalhadasMinutes = Math.min(day.workedMinutes, day.expectedMinutes);
        const extrasMinutes = Math.max(0, day.workedMinutes - day.expectedMinutes);
        const ticketEntry = ticketsByDate.get(day.date);
        return {
          date: day.date,
          horasTrabalhadas: minutesToHours(trabalhadasMinutes),
          horasExtras: minutesToHours(extrasMinutes),
          horasTickets: ticketEntry?.horasTickets ?? 0,
          ticketEntryId: ticketEntry?.id ?? null,
        };
      })
      .filter((item) => item.horasTrabalhadas > 0 || item.horasExtras > 0 || item.horasTickets > 0)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  async remove(id: string): Promise<void> {
    await this.prisma.workedHoursEntry.delete({ where: { id } });
  }
}
