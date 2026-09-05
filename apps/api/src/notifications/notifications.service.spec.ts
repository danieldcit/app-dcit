process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;
  const sendToUser = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        PrismaService,
        { provide: ExpoPushService, useValue: { sendToUser } },
      ],
    }).compile();

    service = module.get(NotificationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(() => {
    sendToUser.mockReset();
  });

  afterEach(async () => {
    await prisma.notification.deleteMany();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  describe('sendPagamento', () => {
    it('creates one Notification per userId with the category message', async () => {
      await service.sendPagamento('vale_transporte', ['user-1', 'user-2']);

      const notifications = await prisma.notification.findMany({
        orderBy: { userId: 'asc' },
      });
      expect(notifications).toHaveLength(2);
      expect(notifications[0]).toMatchObject({
        userId: 'user-1',
        type: 'pagamento',
        category: 'vale_transporte',
        message: 'Seu vale-transporte foi depositado.',
      });
      expect(notifications[1]).toMatchObject({
        userId: 'user-2',
        type: 'pagamento',
        category: 'vale_transporte',
      });
    });

    it('sends a push to every recipient with the notification id and link in the data payload', async () => {
      await service.sendPagamento('salario', ['user-1', 'user-2']);

      expect(sendToUser).toHaveBeenCalledTimes(2);

      const notifications = await prisma.notification.findMany({ orderBy: { userId: 'asc' } });
      expect(notifications).toHaveLength(2);

      for (const notification of notifications) {
        expect(sendToUser).toHaveBeenCalledWith(notification.userId, {
          title: 'Ponto DCIT',
          body: 'Seu salário foi depositado.',
          data: { notificationId: notification.id, link: null },
        });
      }
    });
  });

  describe('pagamentoStatus', () => {
    it('returns only notifications within the date range', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-09-05T12:00:00.000Z'),
        },
      });
      await prisma.notification.create({
        data: {
          userId: 'user-2',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-08-05T12:00:00.000Z'), // outside the range below
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([{ userId: 'user-1', sentAt: '2026-09-05T12:00:00.000Z' }]);
    });

    it('keeps only the most recent sentAt when a userId was notified twice', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-09-05T12:00:00.000Z'),
        },
      });
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-09-10T12:00:00.000Z'),
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([{ userId: 'user-1', sentAt: '2026-09-10T12:00:00.000Z' }]);
    });

    it('includes a notification sent late evening São Paulo time on the last day of the range (already the next day in UTC)', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          // 2026-09-30T23:30 in São Paulo (UTC-3) is 2026-10-01T02:30Z —
          // outside a bare-UTC ['2026-09-01', '2026-09-30T23:59:59.999Z']
          // window, but still squarely within the São-Paulo calendar range.
          createdAt: new Date('2026-09-30T23:30:00.000-03:00'),
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([
        { userId: 'user-1', sentAt: new Date('2026-09-30T23:30:00.000-03:00').toISOString() },
      ]);
    });

    it('does not mix categories', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'vale_alimentacao',
          message: 'Seu vale-alimentação foi depositado.',
          createdAt: new Date('2026-09-05T12:00:00.000Z'),
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([]);
    });
  });

  describe('listMine', () => {
    it('returns only the given userId\'s notifications, newest first', async () => {
      await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Primeira', createdAt: new Date('2026-09-01T00:00:00.000Z') },
      });
      await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Segunda', createdAt: new Date('2026-09-02T00:00:00.000Z') },
      });
      await prisma.notification.create({
        data: { userId: 'user-2', type: 'pagamento', message: 'De outro usuário' },
      });

      const mine = await service.listMine('user-1');

      expect(mine.map((n) => n.message)).toEqual(['Segunda', 'Primeira']);
    });
  });

  describe('markRead', () => {
    it('sets readAt on the caller\'s own notification', async () => {
      const created = await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Teste' },
      });

      await service.markRead(created.id, 'user-1');

      const updated = await prisma.notification.findUniqueOrThrow({ where: { id: created.id } });
      expect(updated.readAt).not.toBeNull();
    });

    it('does not mark another user\'s notification as read', async () => {
      const created = await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Teste' },
      });

      await service.markRead(created.id, 'user-2');

      const untouched = await prisma.notification.findUniqueOrThrow({ where: { id: created.id } });
      expect(untouched.readAt).toBeNull();
    });
  });

  describe('sendPontoPerdido', () => {
    afterEach(async () => {
      await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-ponto-perdido-' } } });
    });

    it('notifies the employee and every active gestor/rh, excluding the employee themself', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-colaborador',
          name: 'Carla Colaboradora',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-gestor',
          name: 'Gustavo Gestor',
          role: 'gestor',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-rh',
          name: 'Rita RH',
          role: 'rh',
          hireDate: new Date('2024-01-01'),
        },
      });
      // Deleted (inactive) gestor must never receive a broadcast copy.
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-gestor-inativo',
          name: 'Gustavo Inativo',
          role: 'gestor',
          hireDate: new Date('2024-01-01'),
          deletedAt: new Date('2026-01-01'),
        },
      });

      await service.sendPontoPerdido(
        'saida_esquecida',
        'user-ponto-perdido-colaborador',
        'Carla Colaboradora',
        '2026-09-01',
      );

      const notifications = await prisma.notification.findMany({
        where: { type: 'ponto_perdido' },
        orderBy: { userId: 'asc' },
      });
      expect(notifications).toHaveLength(3);
      expect(notifications.map((n) => n.userId).sort()).toEqual(
        [
          'user-ponto-perdido-colaborador',
          'user-ponto-perdido-gestor',
          'user-ponto-perdido-rh',
        ].sort(),
      );

      const colaboradorNotif = notifications.find(
        (n) => n.userId === 'user-ponto-perdido-colaborador',
      )!;
      expect(colaboradorNotif).toMatchObject({
        type: 'ponto_perdido',
        category: 'saida_esquecida',
        message: 'Você esqueceu de bater o ponto de saída em 01/09/2026.',
        link: '/historico',
      });

      const gestorNotif = notifications.find(
        (n) => n.userId === 'user-ponto-perdido-gestor',
      )!;
      expect(gestorNotif).toMatchObject({
        type: 'ponto_perdido',
        category: 'saida_esquecida',
        message: 'Carla Colaboradora esqueceu de bater o ponto de saída em 01/09/2026.',
        link: null,
      });

      expect(sendToUser).toHaveBeenCalledTimes(3);
      expect(sendToUser).toHaveBeenCalledWith(
        'user-ponto-perdido-colaborador',
        expect.objectContaining({
          title: 'Ponto DCIT',
          data: expect.objectContaining({ notificationId: colaboradorNotif.id, link: '/historico' }),
        }),
      );
    });

    it("excludes the flagged employee's own broadcast copy when they are also a gestor", async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-gestor-faltoso',
          name: 'Gilberto Gestor',
          role: 'gestor',
          hireDate: new Date('2024-01-01'),
        },
      });

      await service.sendPontoPerdido(
        'ausencia',
        'user-ponto-perdido-gestor-faltoso',
        'Gilberto Gestor',
        '2026-09-01',
      );

      const notifications = await prisma.notification.findMany({
        where: { type: 'ponto_perdido' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        userId: 'user-ponto-perdido-gestor-faltoso',
        message: 'Não identificamos nenhum ponto registrado em 01/09/2026.',
        link: '/historico',
      });
    });
  });

  describe('sendMural', () => {
    afterEach(async () => {
      await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-mural-' } } });
    });

    it('notifies every active employee except the poster', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-mural-poster',
          name: 'Paula Poster',
          role: 'rh',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-mural-colaborador',
          name: 'Carlos Colaborador',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-mural-gestor',
          name: 'Gustavo Gestor',
          role: 'gestor',
          hireDate: new Date('2024-01-01'),
        },
      });
      // Deleted (inactive) employee must never receive a broadcast copy.
      await prisma.employee.create({
        data: {
          userId: 'user-mural-inativo',
          name: 'Inês Inativa',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          deletedAt: new Date('2026-01-01'),
        },
      });

      await service.sendMural('Boas-vindas!', 'user-mural-poster');

      const notifications = await prisma.notification.findMany({
        where: { type: 'mural' },
        orderBy: { userId: 'asc' },
      });
      expect(notifications.map((n) => n.userId).sort()).toEqual(
        ['user-mural-colaborador', 'user-mural-gestor'].sort(),
      );
      expect(notifications[0]).toMatchObject({
        type: 'mural',
        category: null,
        message: '"Boas-vindas!" foi publicado no mural.',
        link: '/mural',
      });
    });

    it('sends a push to every recipient with the notification id and link in the data payload', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-mural-poster',
          name: 'Paula Poster',
          role: 'rh',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-mural-recipient',
          name: 'Rita Recipient',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await service.sendMural('Aviso', 'user-mural-poster');
      // Push dispatch is fire-and-forget (`void Promise.all(...)`) — give the
      // microtask queue a turn before asserting, same pattern already used by
      // the sendPagamento push-dispatch test in this file.
      await new Promise((resolve) => setImmediate(resolve));

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'mural', userId: 'user-mural-recipient' },
      });
      expect(sendToUser).toHaveBeenCalledWith('user-mural-recipient', {
        title: 'Ponto DCIT',
        body: '"Aviso" foi publicado no mural.',
        data: { notificationId: notification.id, link: '/mural' },
      });
    });
  });

  describe('sendCareerLevelUp', () => {
    it('creates one notification for the colaborador with the sub-nível, salary and nota final', async () => {
      await service.sendCareerLevelUp('user-career-colaborador', 'Júnior 3', 3400, 7.5);

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'carreira', userId: 'user-career-colaborador' },
      });
      expect(notification).toMatchObject({
        type: 'carreira',
        category: null,
        message: '🚀 Parabéns! Você avançou para Júnior 3. Novo salário: R$ 3.400,00. Sua nota final: 7,5/10.',
        link: null,
      });
    });

    it('sends a push to the colaborador with the notification id in the data payload', async () => {
      await service.sendCareerLevelUp('user-career-colaborador-2', 'Pleno 2', 4700, 6.2);
      await new Promise((resolve) => setImmediate(resolve));

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'carreira', userId: 'user-career-colaborador-2' },
      });
      expect(sendToUser).toHaveBeenCalledWith('user-career-colaborador-2', {
        title: 'Ponto DCIT',
        body: notification.message,
        data: { notificationId: notification.id, link: null },
      });
    });
  });

  describe('sendDocumentSubmitted', () => {
    afterEach(async () => {
      await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-doc-sub-' } } });
    });

    it('notifies every active gestor/rh, not colaborador', async () => {
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-gestor', name: 'Gustavo Gestor', role: 'gestor', hireDate: new Date('2024-01-01') },
      });
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-rh', name: 'Rita RH', role: 'rh', hireDate: new Date('2024-01-01') },
      });
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-colaborador', name: 'Carla Colaboradora', role: 'colaborador', hireDate: new Date('2024-01-01') },
      });
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-gestor-inativo', name: 'Inativo', role: 'gestor', hireDate: new Date('2024-01-01'), deletedAt: new Date('2026-01-01') },
      });

      await service.sendDocumentSubmitted('atestado', 'user-doc-sub-colaborador', 'Carla Colaboradora');

      const notifications = await prisma.notification.findMany({ where: { type: 'documento_enviado' } });
      expect(notifications.map((n) => n.userId).sort()).toEqual(
        ['user-doc-sub-gestor', 'user-doc-sub-rh'].sort(),
      );
      expect(notifications[0]).toMatchObject({
        type: 'documento_enviado',
        category: 'atestado',
        message: 'Carla Colaboradora enviou um atestado.',
        link: '/documentos',
      });
    });

    it('uses the admissional wording for kind admissional', async () => {
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-rh2', name: 'Rita RH', role: 'rh', hireDate: new Date('2024-01-01') },
      });

      await service.sendDocumentSubmitted('admissional', 'user-doc-sub-colaborador-2', 'Davi Colaborador');

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_enviado', userId: 'user-doc-sub-rh2' },
      });
      expect(notification.message).toBe('Davi Colaborador enviou um documento admissional.');
    });

    it('sends a push to every recipient with the notification id and link', async () => {
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-rh3', name: 'Rita RH', role: 'rh', hireDate: new Date('2024-01-01') },
      });

      await service.sendDocumentSubmitted('atestado', 'user-doc-sub-colaborador-3', 'Elis Colaboradora');
      await new Promise((resolve) => setImmediate(resolve));

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_enviado', userId: 'user-doc-sub-rh3' },
      });
      expect(sendToUser).toHaveBeenCalledWith('user-doc-sub-rh3', {
        title: 'Ponto DCIT',
        body: notification.message,
        data: { notificationId: notification.id, link: '/documentos' },
      });
    });
  });

  describe('sendDocumentStatusChanged', () => {
    it('notifies only the given user, aprovado wording', async () => {
      await service.sendDocumentStatusChanged('atestado', 'user-doc-status-1', 'aprovado');

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_status', userId: 'user-doc-status-1' },
      });
      expect(notification).toMatchObject({
        category: 'atestado',
        message: 'Seu atestado foi aprovado.',
        link: '/documentos?categoria=atestados',
      });
    });

    it('notifies with the reprovado wording and the admissional link', async () => {
      await service.sendDocumentStatusChanged('admissional', 'user-doc-status-2', 'recusado');

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_status', userId: 'user-doc-status-2' },
      });
      expect(notification).toMatchObject({
        category: 'admissional',
        message: 'Seu documento admissional foi reprovado.',
        link: '/documentos?categoria=admissionais',
      });
    });

    it('sends a push with the notification id and link', async () => {
      await service.sendDocumentStatusChanged('atestado', 'user-doc-status-3', 'aprovado');
      await new Promise((resolve) => setImmediate(resolve));

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_status', userId: 'user-doc-status-3' },
      });
      expect(sendToUser).toHaveBeenCalledWith('user-doc-status-3', {
        title: 'Ponto DCIT',
        body: 'Seu atestado foi aprovado.',
        data: { notificationId: notification.id, link: '/documentos?categoria=atestados' },
      });
    });
  });
});
