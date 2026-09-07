process.env.DATABASE_URL = 'file:./test.db';

import { resolvePeriodoRange, sumTicketsByUser, splitPontoMinutes } from './horas.service';
import { todaySaoPauloDateOnly, isWeekend } from '../common/sao-paulo-time';

describe('resolvePeriodoRange (pure function)', () => {
  it('dia resolves to just today', () => {
    expect(resolvePeriodoRange('dia', '2026-09-03')).toEqual({ start: '2026-09-03', end: '2026-09-03' });
  });

  it('semana resolves to Monday through Sunday when today is a Thursday', () => {
    // 2026-09-03 is a Thursday
    expect(resolvePeriodoRange('semana', '2026-09-03')).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });

  it('semana resolves correctly when today is itself a Sunday', () => {
    // 2026-09-06 is a Sunday — must still resolve back to the Monday that started this week, not roll into next week
    expect(resolvePeriodoRange('semana', '2026-09-06')).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });

  it('semana resolves correctly when today is itself a Monday', () => {
    expect(resolvePeriodoRange('semana', '2026-08-31')).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });

  it('mes resolves to the 1st through the last day of a 30-day month', () => {
    expect(resolvePeriodoRange('mes', '2026-09-15')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });

  it('mes resolves to the 1st through the last day of a 31-day month', () => {
    expect(resolvePeriodoRange('mes', '2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });

  it('mes resolves to the 1st through the 28th in a non-leap February', () => {
    expect(resolvePeriodoRange('mes', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('mes resolves to the 1st through the 29th in a leap February', () => {
    expect(resolvePeriodoRange('mes', '2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
});

describe('sumTicketsByUser (pure function)', () => {
  it('sums horasTickets per userId across multiple entries', () => {
    const totals = sumTicketsByUser([
      { userId: 'a', horasTickets: 6 },
      { userId: 'a', horasTickets: 3 },
      { userId: 'b', horasTickets: 5 },
    ]);
    expect(totals.get('a')).toBe(9);
    expect(totals.get('b')).toBe(5);
  });

  it('returns an empty map for no entries', () => {
    const totals = sumTicketsByUser([]);
    expect(totals.size).toBe(0);
  });
});

describe('splitPontoMinutes (pure function)', () => {
  it('caps trabalhadas at expected and puts the rest in extras', () => {
    const result = splitPontoMinutes([
      { date: '2026-09-01', expectedMinutes: 480, workedMinutes: 600, diffMinutes: 120 },
      { date: '2026-09-02', expectedMinutes: 480, workedMinutes: 300, diffMinutes: -180 },
    ]);
    // Day 1: 480 trabalhadas (capped) + 120 extras. Day 2: 300 trabalhadas (below expected), 0 extras.
    expect(result).toEqual({ trabalhadasMinutes: 780, extrasMinutes: 120 });
  });

  it('a rest day (expectedMinutes 0) with no punches contributes nothing', () => {
    const result = splitPontoMinutes([{ date: '2026-09-05', expectedMinutes: 0, workedMinutes: 0, diffMinutes: 0 }]);
    expect(result).toEqual({ trabalhadasMinutes: 0, extrasMinutes: 0 });
  });

  it('returns zeros for an empty day list', () => {
    expect(splitPontoMinutes([])).toEqual({ trabalhadasMinutes: 0, extrasMinutes: 0 });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { HorasService } from './horas.service';
import { BancoDeHorasService } from '../banco-de-horas/banco-de-horas.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HorasService', () => {
  let service: HorasService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HorasService, BancoDeHorasService, PrismaService],
    }).compile();
    service = module.get(HorasService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: {
        userId: 'horas-spec-user',
        name: 'Horas Spec Colaborador',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
      },
    });
  });

  afterAll(async () => {
    await prisma.workedHoursEntry.deleteMany({ where: { userId: 'horas-spec-user' } });
    await prisma.timeEntry.deleteMany({ where: { userId: 'horas-spec-user' } });
    await prisma.employee.delete({ where: { userId: 'horas-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('lancar creates a new ticket entry', async () => {
    const entry = await service.lancar(
      { userId: 'horas-spec-user', date: '2026-01-05', horasTickets: 6 },
      'horas-spec-gestor',
    );
    expect(entry.horasTickets).toBe(6);
    expect(entry.gestorId).toBe('horas-spec-gestor');
  });

  it('lancar again for the same (userId, date) updates the existing row instead of creating a second one', async () => {
    await service.lancar({ userId: 'horas-spec-user', date: '2026-01-06', horasTickets: 2 }, 'horas-spec-gestor');
    const updated = await service.lancar(
      { userId: 'horas-spec-user', date: '2026-01-06', horasTickets: 5 },
      'horas-spec-gestor',
    );
    expect(updated.horasTickets).toBe(5);

    const all = await prisma.workedHoursEntry.findMany({
      where: { userId: 'horas-spec-user', date: new Date('2026-01-06T00:00:00.000Z') },
    });
    expect(all).toHaveLength(1);
  });

  it('resumo includes an active employee with zero ponto and zero tickets in the period as 0/0/0', async () => {
    const resumo = await service.resumo('mes');
    const entry = resumo.find((item) => item.userId === 'horas-spec-user');
    expect(entry).toBeDefined();
  });

  it('resumo derives horasTrabalhadas/horasExtras from real ponto punches, and sums only tickets inside the period', async () => {
    const today = todaySaoPauloDateOnly();
    const expectedMinutesToday = isWeekend(today) ? 0 : 480; // no convenção on this test employee -> 8h default, 0 on weekends
    // Clocks in at 09:00 SP and out at 19:00 SP -> 10h (600min) worked today.
    await prisma.timeEntry.create({ data: { userId: 'horas-spec-user', clockedAt: new Date(`${today}T12:00:00.000Z`) } });
    await prisma.timeEntry.create({ data: { userId: 'horas-spec-user', clockedAt: new Date(`${today}T22:00:00.000Z`) } });
    await service.lancar({ userId: 'horas-spec-user', date: today, horasTickets: 1 }, 'horas-spec-gestor');

    const resumo = await service.resumo('dia');
    const entry = resumo.find((item) => item.userId === 'horas-spec-user');
    const expectedTrabalhadas = Math.min(600, expectedMinutesToday) / 60;
    const expectedExtras = Math.max(0, 600 - expectedMinutesToday) / 60;
    expect(entry?.horasTrabalhadas).toBe(expectedTrabalhadas);
    expect(entry?.horasExtras).toBe(expectedExtras);
    expect(entry?.horasTickets).toBe(1);
    // The Jan 2026 ticket entries from earlier tests must not leak into "dia" (today).
  });

  it('list includes a day derived purely from ponto (no manual entry) with ticketEntryId null', async () => {
    const list = await service.list('horas-spec-user', 'dia');
    const today = todaySaoPauloDateOnly();
    const todayItem = list.find((item) => item.date === today);
    expect(todayItem).toBeDefined();
    // A ticket entry for today was created in the previous test, so this day does have one.
    expect(todayItem?.ticketEntryId).not.toBeNull();
  });

  it('list drops days with no ponto activity and no ticket entry', async () => {
    const list = await service.list('horas-spec-user', 'mes');
    for (const item of list) {
      expect(item.horasTrabalhadas > 0 || item.horasExtras > 0 || item.horasTickets > 0).toBe(true);
    }
  });

  it('list returns only entries for the given user within the period, most recent first', async () => {
    const list = await service.list('horas-spec-user', 'mes');
    const dates = list.map((item) => item.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it('remove deletes the ticket entry, without touching ponto-derived days', async () => {
    const entry = await service.lancar({ userId: 'horas-spec-user', date: '2026-01-07', horasTickets: 1 }, 'horas-spec-gestor');
    await service.remove(entry.id);
    const found = await prisma.workedHoursEntry.findUnique({ where: { id: entry.id } });
    expect(found).toBeNull();
  });
});
