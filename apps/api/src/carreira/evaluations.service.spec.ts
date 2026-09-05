process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { CareerEvaluationsService } from './evaluations.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExpoPushService } from '../push/expo-push.service';
import { MuralService } from '../mural/mural.service';

const USER_ID = 'evaluations-spec-user';

describe('CareerEvaluationsService', () => {
  let service: CareerEvaluationsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareerEvaluationsService,
        PrismaService,
        NotificationsService,
        MuralService,
        { provide: ExpoPushService, useValue: { sendToUser: jest.fn() } },
      ],
    }).compile();
    service = module.get(CareerEvaluationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: { userId: USER_ID, name: 'Ana Teste', role: 'colaborador', nivel: 'pleno', salarioMensal: 4700, hireDate: new Date('2024-01-01') },
    });
  });

  afterAll(async () => {
    const evaluations = await prisma.careerEvaluation.findMany({ where: { userId: USER_ID } });
    const evaluationIds = evaluations.map((e) => e.id);
    await prisma.careerPrincipioScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerCompetenciaScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerRequisitoCheck.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerEvaluation.deleteMany({ where: { userId: USER_ID } });
    await prisma.notification.deleteMany({ where: { userId: USER_ID } });
    await prisma.muralPost.deleteMany({ where: { title: { contains: 'Ana Teste' } } });
    await prisma.employee.delete({ where: { userId: USER_ID } });
    await prisma.onModuleDestroy();
  });

  const PRINCIPIOS_NOTAS = [
    { principio: 'clareza', nota: 8, justificativa: 'Boa.' },
    { principio: 'meritocracia', nota: 8 },
    { principio: 'equilibrio', nota: 8 },
    { principio: 'transparencia', nota: 8 },
    { principio: 'desenvolvimento', nota: 8 },
  ];
  const COMPETENCIAS_NOTAS = [
    { competencia: 'dominio_tecnico', nota: 6, justificativa: 'Domínio sólido, ainda em evolução.' },
    { competencia: 'qualidade_solucoes', nota: 6 },
    { competencia: 'kpis_tecnicos', nota: 6 },
    { competencia: 'comunicacao_postura', nota: 6 },
    { competencia: 'organizacao_crises', nota: 6 },
    { competencia: 'visao_estrategica', nota: 6 },
  ];

  it('save() creates an evaluation with nivelAvaliado/proximoNivel derived from the employee, and computed mediaGeral', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: ['Graduação completa'],
    });
    expect(evaluation.nivelAvaliado).toBe('pleno');
    expect(evaluation.proximoNivel).toBe('senior');
    expect(evaluation.status).toBe('salva');
    expect(evaluation.evaluatorId).toBe('gestor-1');
    // (8*5 + 6*6) / 11 = 76/11 = 6.909... -> 6.9
    expect(evaluation.mediaGeral).toBeCloseTo(6.9, 1);
    expect(evaluation.principios).toHaveLength(5);
    expect(evaluation.competencias).toHaveLength(6);
    const dominioTecnico = evaluation.competencias.find((c) => c.competencia === 'dominio_tecnico');
    expect(dominioTecnico?.justificativa).toBe('Domínio sólido, ainda em evolução.');
  });

  it('save() persists every requisito of the próximo nível, ignoring atendido labels that belong to a different nível', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      // "Mais de 3 anos de experiência" is a PLENO requisito, not one of SENIOR's —
      // the employee here is pleno, so próximoNivel is senior, and this label must
      // not match (and must not silently get inserted) any of senior's requisitos.
      requisitosAtendidos: ['Mais de 3 anos de experiência'],
    });
    // senior's requisitos: 3 obrigatórios + 4 eletivos = 7 total
    expect(evaluation.requisitos).toHaveLength(7);
    expect(evaluation.requisitos.every((r) => r.atendido === false)).toBe(true);
    expect(evaluation.requisitos.some((r) => r.label === 'Mais de 3 anos de experiência')).toBe(false);
  });

  it('save() marks a requisito atendido when its exact label is sent', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: ['3 anos ou mais como Pleno, com graduação completa'],
    });
    const graduacao = evaluation.requisitos.find((r) => r.label === '3 anos ou mais como Pleno, com graduação completa');
    expect(graduacao?.atendido).toBe(true);
    expect(evaluation.requisitos.filter((r) => r.atendido).length).toBe(1);
  });

  it('save() called twice updates the same open evaluation in place rather than creating a second one', async () => {
    const first = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    const second = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    expect(second.id).toBe(first.id);
    expect(second.principios.every((p) => p.nota === 10)).toBe(true);
    const openCount = await prisma.careerEvaluation.count({ where: { userId: USER_ID, status: 'salva' } });
    expect(openCount).toBe(1);
  });

  it('getOpen() returns null when no evaluation has been saved yet for a different user', async () => {
    const result = await service.getOpen('nobody-has-evaluated-this-user');
    expect(result).toBeNull();
  });

  it('getOpen() returns the open evaluation with its children', async () => {
    await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    const open = await service.getOpen(USER_ID);
    expect(open?.status).toBe('salva');
    expect(open?.principios).toHaveLength(5);
  });

  it('decidir() marks the evaluation decidida with resultado em_desenvolvimento when not eligible, and does not touch Employee', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 2 })), // too low to be eligible
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 2 })),
      requisitosAtendidos: [],
    });
    const decided = await service.decidir(evaluation.id, true);
    expect(decided.status).toBe('decidida');
    expect(decided.resultado).toBe('em_desenvolvimento');
    expect(decided.decidedAt).not.toBeNull();
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('pleno'); // unchanged
  });

  // A pleno employee's próximoNivel is senior, so eligibility checks senior's
  // obrigatórios — NOT pleno's own ("Mais de 3 anos de experiência" etc.,
  // which are what got this employee INTO pleno, already satisfied in the past).
  const SENIOR_OBRIGATORIOS = [
    '3 anos ou mais como Pleno, com graduação completa',
    'Especialização desejável e no mínimo 3 certificações',
    'Soft skills consolidadas e referência técnica',
  ];

  it('decidir() promotes the employee (nivel + salarioMensal) when eligible and confirmarPromocao is true', async () => {
    await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'pleno', salarioMensal: 4700 } });
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 10 })),
      requisitosAtendidos: SENIOR_OBRIGATORIOS,
    });
    const decided = await service.decidir(evaluation.id, true);
    expect(decided.resultado).toBe('promovido');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('senior');
    // média 10 already pushed pleno's own sub-nível to its top degrau (6200)
    // during save(), before decidir() ran — decidir()'s own floor-protection
    // (Math.max against senior's first degrau, 6000) then keeps the higher
    // value, so the promotion lands at 6200, not senior's bare starting degrau.
    expect(employee.salarioMensal).toBe(6200);

    const notification = await prisma.notification.findFirst({
      where: { userId: USER_ID, type: 'carreira', message: { contains: 'Analista Sênior' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification?.message).toContain('Parabéns! Você avançou para Analista Sênior.');

    const post = await prisma.muralPost.findFirst({
      where: { title: { contains: 'Analista Sênior' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(post?.title).toBe('Promoção: Ana Teste agora é Analista Sênior!');
    expect(post?.body).toContain('Ana Teste');
    expect(post?.body).not.toContain('6200'); // never broadcast salary to the whole mural
  });

  it('decidir() computes resultado promovido but does NOT touch Employee when confirmarPromocao is false', async () => {
    await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'pleno', salarioMensal: 4700 } });
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 10 })),
      requisitosAtendidos: SENIOR_OBRIGATORIOS,
    });
    const decided = await service.decidir(evaluation.id, false);
    expect(decided.resultado).toBe('promovido');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('pleno'); // unchanged — gestor did not confirm
  });

  it('decidir() never reduces salary — promoting from the top of a level does not reset salarioMensal downward', async () => {
    await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'pleno', salarioMensal: 6200 } }); // pleno's top step
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 10 })),
      requisitosAtendidos: SENIOR_OBRIGATORIOS,
    });
    const decided = await service.decidir(evaluation.id, true);
    expect(decided.resultado).toBe('promovido');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('senior');
    expect(employee.salarioMensal).toBe(6200); // NOT reset down to senior's degrau[0] of 6000
  });

  describe('sub-nível salary progression on save()', () => {
    it('advances salarioMensal to the degrau matching the média of this cycle', async () => {
      await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'junior', salarioMensal: 2500 } });
      // média 7.0 -> subNivelIndex 2 -> junior's 3rd degrau (3400)
      await service.save('gestor-1', {
        userId: USER_ID,
        principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 7 })),
        competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 7 })),
        requisitosAtendidos: [],
      });
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
      expect(employee.salarioMensal).toBe(3400);
    });

    it('never reduces salarioMensal even when a later cycle submits a lower média', async () => {
      await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'junior', salarioMensal: 3400 } });
      // média 2.0 -> subNivelIndex 0 -> junior's 1st degrau (2500), well below the current 3400
      await service.save('gestor-1', {
        userId: USER_ID,
        principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 2 })),
        competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 2 })),
        requisitosAtendidos: [],
      });
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
      expect(employee.salarioMensal).toBe(3400);
    });

    it('sends a career-level-up notification when the sub-nível-driven salary increases', async () => {
      await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'junior', salarioMensal: 2500 } });
      await service.save('gestor-1', {
        userId: USER_ID,
        principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 7 })),
        competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 7 })),
        requisitosAtendidos: [],
      });
      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'carreira', userId: USER_ID },
        orderBy: { createdAt: 'desc' },
      });
      expect(notification.message).toBe(
        '🚀 Parabéns! Você avançou para Júnior 3. Novo salário: R$ 3.400,00. Sua nota final: 7,0/10.',
      );
    });

    it('does not send a notification when the computed salary does not increase', async () => {
      await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'junior', salarioMensal: 3400 } });
      await prisma.notification.deleteMany({ where: { userId: USER_ID } });
      await service.save('gestor-1', {
        userId: USER_ID,
        principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 2 })),
        competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 2 })),
        requisitosAtendidos: [],
      });
      const notification = await prisma.notification.findFirst({ where: { type: 'carreira', userId: USER_ID } });
      expect(notification).toBeNull();
    });
  });
});
