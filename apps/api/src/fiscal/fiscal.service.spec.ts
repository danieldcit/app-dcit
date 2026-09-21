process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { FiscalService } from './fiscal.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FiscalService.getDashboard', () => {
  let service: FiscalService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalService, PrismaService],
    }).compile();

    service = module.get(FiscalService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    await prisma.benefitBalance.deleteMany({ where: { userId: { startsWith: 'fiscal-test-' } } });
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'fiscal-test-' } } });
    await prisma.fiscalParameters.deleteMany({ where: { id: 'default' } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  async function createEmployee(overrides: Partial<Parameters<typeof prisma.employee.create>[0]['data']> & { userId: string }) {
    return prisma.employee.create({
      data: {
        name: 'Teste Fiscal',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
        ...overrides,
      },
    });
  }

  it('buckets headcount by tipoContratacao, including não-classificado', async () => {
    await createEmployee({ userId: 'fiscal-test-1', tipoContratacao: 'CLT' });
    await createEmployee({ userId: 'fiscal-test-2', tipoContratacao: 'PJ' });
    await createEmployee({ userId: 'fiscal-test-3', tipoContratacao: null });

    const result = await service.getDashboard({});

    expect(result.headcountPorTipo.CLT).toBeGreaterThanOrEqual(1);
    expect(result.headcountPorTipo.PJ).toBeGreaterThanOrEqual(1);
    expect(result.headcountPorTipo.naoClassificado).toBeGreaterThanOrEqual(1);
  });

  it('returns encargosConfigurados=false and encargos=null when FiscalParameters is not set', async () => {
    await createEmployee({ userId: 'fiscal-test-4', tipoContratacao: 'CLT', salarioMensal: 5000 });

    const result = await service.getDashboard({ tipoContratacao: 'CLT' });

    expect(result.encargosConfigurados).toBe(false);
    expect(result.encargos).toBeNull();
  });

  it('computes encargos only over CLT salaries once FiscalParameters is fully configured', async () => {
    await prisma.fiscalParameters.create({
      data: { id: 'default', inssPatronalPercent: 20, ratPercent: 2, fgtsPercent: 8 },
    });
    await createEmployee({ userId: 'fiscal-test-5', tipoContratacao: 'CLT', salarioMensal: 5000, team: 'fiscal-test-team' });
    await createEmployee({ userId: 'fiscal-test-6', tipoContratacao: 'PJ', salarioMensal: 5000, team: 'fiscal-test-team' });

    const result = await service.getDashboard({ team: 'fiscal-test-team' });

    expect(result.encargosConfigurados).toBe(true);
    // 5000 * (20 + 2 + 8) / 100 = 1500 — só sobre o salário CLT, não o PJ
    expect(result.encargos).toBeCloseTo(1500);
  });

  it('treats a null salarioMensal as 0 and flags it in colaboradoresSemSalario', async () => {
    await createEmployee({ userId: 'fiscal-test-7', tipoContratacao: 'CLT', salarioMensal: null, team: 'fiscal-test-sem-salario' });

    const result = await service.getDashboard({ team: 'fiscal-test-sem-salario' });

    expect(result.colaboradoresSemSalario).toBe(1);
    expect(result.custoBase).toBe(0);
  });

  it('filters by team and by tipoContratacao', async () => {
    await createEmployee({ userId: 'fiscal-test-8', tipoContratacao: 'CLT', team: 'fiscal-test-alpha' });
    await createEmployee({ userId: 'fiscal-test-9', tipoContratacao: 'PJ', team: 'fiscal-test-beta' });

    const alphaOnly = await service.getDashboard({ team: 'fiscal-test-alpha' });
    expect(alphaOnly.headcountTotal).toBe(1);
    expect(alphaOnly.headcountPorTipo.CLT).toBe(1);

    const pjOnly = await service.getDashboard({ tipoContratacao: 'PJ', team: 'fiscal-test-beta' });
    expect(pjOnly.headcountPorTipo.PJ).toBe(1);
  });

  it('returns custoMedioPorColaborador=0 when there are no matching employees (no division by zero)', async () => {
    const result = await service.getDashboard({ team: 'fiscal-test-empty-team-xyz' });
    expect(result.headcountTotal).toBe(0);
    expect(result.custoMedioPorColaborador).toBe(0);
  });

  it('returns naoClassificados with only the unclassified employees, respecting filters', async () => {
    await createEmployee({
      userId: 'fiscal-test-10',
      name: 'Ana Não Classificada',
      tipoContratacao: null,
      team: 'fiscal-test-naoclass',
    });
    await createEmployee({
      userId: 'fiscal-test-11',
      name: 'Bruno CLT',
      tipoContratacao: 'CLT',
      team: 'fiscal-test-naoclass',
    });

    const result = await service.getDashboard({ team: 'fiscal-test-naoclass' });

    expect(result.naoClassificados).toEqual([{ userId: 'fiscal-test-10', name: 'Ana Não Classificada' }]);
  });
});

describe('FiscalService parametros', () => {
  let service: FiscalService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalService, PrismaService],
    }).compile();
    service = module.get(FiscalService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    await prisma.fiscalParameters.deleteMany({ where: { id: 'default' } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns null when parameters were never configured', async () => {
    const result = await service.getParametros();
    expect(result).toBeNull();
  });

  it('creates the singleton row on first update', async () => {
    const updated = await service.updateParametros(
      {
        inssPatronalPercent: 20,
        ratPercent: 1,
        fgtsPercent: 8,
        sujeitoDesoneracaoFolha: true,
        fonteLegal: 'Lei 14.973/2024',
        vigenciaData: new Date('2026-01-01'),
      },
      'gestor-1',
    );

    expect(updated.id).toBe('default');
    expect(updated.ratPercent).toBe(1);
    expect(updated.updatedByUserId).toBe('gestor-1');

    const fetched = await service.getParametros();
    expect(fetched?.fonteLegal).toBe('Lei 14.973/2024');
  });

  it('overwrites the existing singleton row on a second update, not create a duplicate', async () => {
    await service.updateParametros(
      { inssPatronalPercent: 20, ratPercent: 1, fgtsPercent: 8, sujeitoDesoneracaoFolha: false, fonteLegal: 'A', vigenciaData: null },
      'gestor-1',
    );
    await service.updateParametros(
      { inssPatronalPercent: 20, ratPercent: 3, fgtsPercent: 8, sujeitoDesoneracaoFolha: true, fonteLegal: 'B', vigenciaData: null },
      'gestor-2',
    );

    const all = await prisma.fiscalParameters.findMany();
    expect(all).toHaveLength(1);
    expect(all[0].ratPercent).toBe(3);
    expect(all[0].updatedByUserId).toBe('gestor-2');
  });
});
