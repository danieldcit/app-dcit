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
    await prisma.fiscalCostSnapshot.deleteMany({});
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
    expect(result.encargosPercentual).toBe(30);
    // custoMensalTotal = 10000 (2x5000) + 1500 encargos = 11500, / 2 colaboradores com salário
    expect(result.custoMedioComDadosCompletos).toBeCloseTo(5750);
    // só o salário CLT (5000), não o total dos dois (10000) — expõe a base
    // real usada no cálculo dos encargos, evitando a confusão do usuário
    // comparar 30% contra custoBase (que inclui PJ também).
    expect(result.folhaCLTConsiderada).toBe(5000);
  });

  it('breaks encargos down by component (INSS patronal, RAT, terceiros, FGTS) including the optional terceirosPercent', async () => {
    await prisma.fiscalParameters.create({
      data: { id: 'default', inssPatronalPercent: 20, ratPercent: 2, terceirosPercent: 5.8, fgtsPercent: 8 },
    });
    await createEmployee({
      userId: 'fiscal-test-14',
      tipoContratacao: 'CLT',
      salarioMensal: 10000,
      team: 'fiscal-test-breakdown',
    });

    const result = await service.getDashboard({ team: 'fiscal-test-breakdown' });

    expect(result.encargosPercentual).toBeCloseTo(35.8);
    expect(result.encargosPercentuais).toEqual({ inssPatronal: 20, rat: 2, terceiros: 5.8, fgts: 8 });
    expect(result.encargosBreakdown).toEqual({
      inssPatronal: 2000,
      rat: 200,
      terceiros: 580,
      fgts: 800,
      total: 3580,
    });
    expect(result.encargos).toBeCloseTo(3580);
  });

  it('omits terceiros from encargosPercentual/encargosBreakdown when terceirosPercent is not configured', async () => {
    await prisma.fiscalParameters.create({
      data: { id: 'default', inssPatronalPercent: 20, ratPercent: 2, fgtsPercent: 8 },
    });
    await createEmployee({
      userId: 'fiscal-test-15',
      tipoContratacao: 'CLT',
      salarioMensal: 10000,
      team: 'fiscal-test-no-terceiros',
    });

    const result = await service.getDashboard({ team: 'fiscal-test-no-terceiros' });

    expect(result.encargosPercentual).toBe(30);
    expect(result.encargosBreakdown?.terceiros).toBe(0);
  });

  it('computes custosPorColaborador per employee (salário + encargos individuais + benefícios)', async () => {
    await prisma.fiscalParameters.create({
      data: { id: 'default', inssPatronalPercent: 20, ratPercent: 2, fgtsPercent: 8 },
    });
    const joao = await createEmployee({
      userId: 'fiscal-test-16',
      name: 'João',
      tipoContratacao: 'CLT',
      salarioMensal: 5000,
      team: 'fiscal-test-porcolab',
    });
    await createEmployee({
      userId: 'fiscal-test-17',
      name: 'Maria PJ',
      tipoContratacao: 'PJ',
      salarioMensal: 4000,
      team: 'fiscal-test-porcolab',
    });
    await prisma.benefitBalance.create({
      data: { userId: joao.userId, icon: '🍔', label: 'VR', balance: 0, monthlyCredit: 500 },
    });

    const result = await service.getDashboard({ team: 'fiscal-test-porcolab' });

    const joaoResult = result.custosPorColaborador.find((c) => c.userId === 'fiscal-test-16');
    // 5000 * 30% = 1500 de encargos (só CLT); custo total = 5000 + 1500 + 500 benefício = 7000
    expect(joaoResult).toEqual({
      userId: 'fiscal-test-16',
      name: 'João',
      tipoContratacao: 'CLT',
      salarioMensal: 5000,
      encargos: 1500,
      encargosBreakdown: { inssPatronal: 1000, rat: 100, terceiros: 0, fgts: 400, total: 1500 },
      beneficios: 500,
      custoTotal: 7000,
    });

    const mariaResult = result.custosPorColaborador.find((c) => c.userId === 'fiscal-test-17');
    // PJ não tem encargos (encargos = null); custo total = só o salário + 0 benefício
    expect(mariaResult).toEqual({
      userId: 'fiscal-test-17',
      name: 'Maria PJ',
      tipoContratacao: 'PJ',
      salarioMensal: 4000,
      encargos: null,
      encargosBreakdown: null,
      beneficios: 0,
      custoTotal: 4000,
    });

    // 1 CLT com salário (João) — a Maria é PJ, não entra nesse contador,
    // usado pra explicar ao gestor por que a "base considerada" dos
    // encargos não bate com a soma de todos os salários da equipe.
    expect(result.cltComSalario).toBe(1);
  });

  it('leaves encargosBreakdown/encargos null (not zeroed) for a CLT employee with no salário cadastrado', async () => {
    await prisma.fiscalParameters.create({
      data: { id: 'default', inssPatronalPercent: 20, ratPercent: 2, fgtsPercent: 8 },
    });
    await createEmployee({
      userId: 'fiscal-test-18',
      name: 'Bruno Sem Salário',
      tipoContratacao: 'CLT',
      salarioMensal: null,
      team: 'fiscal-test-semsalario-clt',
    });

    const result = await service.getDashboard({ team: 'fiscal-test-semsalario-clt' });

    const brunoResult = result.custosPorColaborador.find((c) => c.userId === 'fiscal-test-18');
    expect(brunoResult).toEqual({
      userId: 'fiscal-test-18',
      name: 'Bruno Sem Salário',
      tipoContratacao: 'CLT',
      salarioMensal: null,
      encargos: null,
      encargosBreakdown: null,
      beneficios: 0,
      custoTotal: 0,
    });
  });

  it('returns parametrosAtualizadoEm/parametrosVigenciaData from the FiscalParameters row', async () => {
    await prisma.fiscalParameters.create({
      data: {
        id: 'default',
        inssPatronalPercent: 20,
        ratPercent: 2,
        fgtsPercent: 8,
        vigenciaData: new Date('2026-01-01'),
      },
    });

    const result = await service.getDashboard({});

    expect(result.parametrosAtualizadoEm).not.toBeNull();
    expect(result.parametrosVigenciaData).toEqual(new Date('2026-01-01'));
  });

  it('returns parametrosAtualizadoEm/parametrosVigenciaData as null when FiscalParameters is not set', async () => {
    const result = await service.getDashboard({ team: 'fiscal-test-empty-team-xyz' });

    expect(result.parametrosAtualizadoEm).toBeNull();
    expect(result.parametrosVigenciaData).toBeNull();
  });

  it('treats a null salarioMensal as 0 and flags it in colaboradoresSemSalario', async () => {
    await createEmployee({ userId: 'fiscal-test-7', tipoContratacao: 'CLT', salarioMensal: null, team: 'fiscal-test-sem-salario' });

    const result = await service.getDashboard({ team: 'fiscal-test-sem-salario' });

    expect(result.colaboradoresSemSalario).toBe(1);
    expect(result.custoBase).toBe(0);
    expect(result.custoMedioComDadosCompletos).toBeNull();
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

  it('includes an empty historico with historicoCombinacaoNaoSuportada=false when no snapshots exist yet', async () => {
    const result = await service.getDashboard({});
    expect(result.historico).toEqual([]);
    expect(result.historicoCombinacaoNaoSuportada).toBe(false);
  });

  it('flags historicoCombinacaoNaoSuportada when both team and tipoContratacao filters are set', async () => {
    const result = await service.getDashboard({ team: 'fiscal-test-alpha', tipoContratacao: 'CLT' });
    expect(result.historico).toEqual([]);
    expect(result.historicoCombinacaoNaoSuportada).toBe(true);
  });

  it('computes variacaoCustoMensalPercent/variacaoCustoMedioPercent against the last snapshot before the current month', async () => {
    // Scoped by team (not the global {} filter) so this test's numbers can't
    // be diluted by unrelated employees living elsewhere in the shared
    // test.db — same reasoning as the team-scoped tests above.
    await createEmployee({ userId: 'fiscal-test-12', tipoContratacao: 'CLT', salarioMensal: 5000, team: 'fiscal-test-mom' });
    await createEmployee({ userId: 'fiscal-test-13', tipoContratacao: 'CLT', salarioMensal: 5000, team: 'fiscal-test-mom' });

    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
    await service.captureSnapshot(lastMonth); // snapshot do time: custoMensalTotal 10000, 2 pessoas

    await prisma.employee.update({ where: { userId: 'fiscal-test-12' }, data: { salarioMensal: 7000 } });

    const result = await service.getDashboard({ team: 'fiscal-test-mom' });

    // custoMensalTotal atual = 12000 vs anterior 10000 => +20%
    expect(result.variacaoCustoMensalPercent).toBeCloseTo(20);
    // custoMedio atual = 12000/2 = 6000 vs anterior 10000/2 = 5000 => +20%
    expect(result.variacaoCustoMedioPercent).toBeCloseTo(20);
  });
});

describe('FiscalService.captureSnapshot / getHistorico', () => {
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
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'fiscal-snap-' } } });
    await prisma.fiscalCostSnapshot.deleteMany({});
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('captures a total row, one row per distinct team, and one row per tipoContratacao', async () => {
    await prisma.employee.create({
      data: {
        userId: 'fiscal-snap-1',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
        tipoContratacao: 'CLT',
        team: 'fiscal-snap-alpha',
        salarioMensal: 5000,
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'fiscal-snap-2',
        name: 'Bruno',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
        tipoContratacao: 'PJ',
        team: 'fiscal-snap-beta',
        salarioMensal: 3000,
      },
    });

    await service.captureSnapshot(new Date('2026-09-15T12:00:00Z'));

    const rows = await prisma.fiscalCostSnapshot.findMany({ orderBy: [{ team: 'asc' }, { tipoContratacao: 'asc' }] });
    // total + 2 times + 3 tipos = 6 linhas
    expect(rows).toHaveLength(6);

    const total = rows.find((r) => r.team === '' && r.tipoContratacao === '');
    expect(total?.custoBase).toBe(8000);
    expect(total?.headcountTotal).toBe(2);

    const alpha = rows.find((r) => r.team === 'fiscal-snap-alpha');
    expect(alpha?.custoBase).toBe(5000);

    const clt = rows.find((r) => r.tipoContratacao === 'CLT');
    expect(clt?.custoBase).toBe(5000);

    expect(rows.every((r) => r.month.toISOString() === new Date('2026-09-01T00:00:00.000Z').toISOString())).toBe(
      true,
    );
  });

  it('is idempotent: capturing twice for the same month updates rows instead of duplicating them', async () => {
    await prisma.employee.create({
      data: {
        userId: 'fiscal-snap-3',
        name: 'Carla',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
        tipoContratacao: 'CLT',
        salarioMensal: 4000,
      },
    });

    await service.captureSnapshot(new Date('2026-09-10T12:00:00Z'));
    await prisma.employee.update({ where: { userId: 'fiscal-snap-3' }, data: { salarioMensal: 4500 } });
    await service.captureSnapshot(new Date('2026-09-20T12:00:00Z'));

    const rows = await prisma.fiscalCostSnapshot.findMany({ where: { team: '', tipoContratacao: '' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].custoBase).toBe(4500);
  });

  it('getHistorico returns only rows matching the requested filter axis, oldest first', async () => {
    await service.captureSnapshot(new Date('2026-08-01T12:00:00Z'));
    await prisma.employee.create({
      data: {
        userId: 'fiscal-snap-4',
        name: 'Diego',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
        tipoContratacao: 'CLT',
        team: 'fiscal-snap-gamma',
        salarioMensal: 1000,
      },
    });
    await service.captureSnapshot(new Date('2026-09-01T12:00:00Z'));

    const total = await service.getHistorico({});
    expect(total.historico.map((h) => h.month.getUTCMonth())).toEqual([7, 8]); // ago, set

    const porTime = await service.getHistorico({ team: 'fiscal-snap-gamma' });
    expect(porTime.historico).toHaveLength(1);

    const porTipo = await service.getHistorico({ tipoContratacao: 'CLT' });
    expect(porTipo.historico.length).toBeGreaterThanOrEqual(1);
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
