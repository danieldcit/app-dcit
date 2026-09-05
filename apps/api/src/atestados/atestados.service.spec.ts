process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { AtestadosService } from './atestados.service';
import { ANTHROPIC_CLIENT } from './anthropic-client.token';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('AtestadosService', () => {
  let service: AtestadosService;
  let prisma: PrismaService;
  const parseMock = jest.fn();
  const anthropicMock = { messages: { parse: parseMock } };
  const notificationsMock = {
    sendDocumentStatusChanged: jest.fn(),
    sendDocumentSubmitted: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtestadosService,
        { provide: ANTHROPIC_CLIENT, useValue: anthropicMock },
        PrismaService,
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get(AtestadosService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.atestado.deleteMany();
    await prisma.onModuleDestroy();
  });

  it('sends the image to Claude and returns the parsed extraction', async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        cid: 'J06.9',
        crm: 'CRM-MG 45213',
        medico: 'Dr. Carlos Mendes',
        dias: 2,
      },
    });

    const result = await service.extract({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/jpeg',
    });

    expect(result).toEqual({
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });

    expect(parseMock).toHaveBeenCalledTimes(1);
    const calls = parseMock.mock.calls as unknown[][];
    const callArgs = calls[0][0] as {
      model: string;
      messages: Array<{
        role: string;
        content: Array<{
          type: string;
          source?: { type: string; media_type: string; data: string };
        }>;
      }>;
    };
    expect(callArgs.model).toBe('claude-haiku-4-5');
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
    const imageBlock = callArgs.messages[0].content.find(
      (block) => block.type === 'image',
    );
    expect(imageBlock?.source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: 'aGVsbG8=',
    });
  });

  it('throws when Claude cannot return a structured result', async () => {
    parseMock.mockResolvedValue({ parsed_output: null });

    await expect(
      service.extract({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws a generic error when the Claude API call fails', async () => {
    parseMock.mockRejectedValue(new Error('network error'));

    await expect(
      service.extract({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('notifies gestor/rh after creating an atestado', async () => {
    await service.create('user-notify-submit', 'Nara Notificação', {
      cid: 'J06.9',
      crm: 'CRM-MG 1',
      medico: 'Dr. Teste',
      dias: 2,
    });

    expect(notificationsMock.sendDocumentSubmitted).toHaveBeenCalledWith(
      'atestado',
      'user-notify-submit',
      'Nara Notificação',
    );
  });

  it('creates and lists atestados scoped to the user', async () => {
    await service.create('user-a', 'Ana Colaboradora', {
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });
    await service.create('user-b', 'Bruno Gestor', {
      cid: 'M54.5',
      crm: 'CRM-MG 11111',
      medico: 'Dra. Fernanda Costa',
      dias: 1,
    });

    const results = await service.listMine('user-a');

    expect(results).toHaveLength(1);
    expect(results[0].cid).toBe('J06.9');
    expect(results[0].status).toBe('enviado');
  });

  it('masks clinical fields for a gestor viewer but not for rh', async () => {
    await service.create('user-c', 'Carla Colaboradora', {
      cid: 'R51',
      crm: 'CRM-MG 33012',
      medico: 'Dra. Fernanda Costa',
      dias: 1,
    });

    const gestorView = await service.listTeam('gestor');
    const rhView = await service.listTeam('rh');

    const gestorEntry = gestorView.find((a) => a.userId === 'user-c');
    const rhEntry = rhView.find((a) => a.userId === 'user-c');

    expect(gestorEntry?.cid).toBeNull();
    expect(gestorEntry?.crm).toBeNull();
    expect(gestorEntry?.medico).toBeNull();
    expect(rhEntry?.cid).toBe('R51');
    expect(rhEntry?.crm).toBe('CRM-MG 33012');
    expect(rhEntry?.medico).toBe('Dra. Fernanda Costa');
  });

  it('persists photoDataUrl on create', async () => {
    const created = await service.create('user-photo', 'Paula', {
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
      photoDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
    });

    expect(created.photoDataUrl).toBe(
      'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
    );
  });

  it('never includes photoDataUrl in the team list, for either role', async () => {
    await service.create('user-f', 'Fabio Colaborador', {
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
      photoDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
    });

    const gestorView = await service.listTeam('gestor');
    const rhView = await service.listTeam('rh');

    const gestorEntry = gestorView.find((a) => a.userId === 'user-f') as Record<
      string,
      unknown
    >;
    const rhEntry = rhView.find((a) => a.userId === 'user-f') as Record<
      string,
      unknown
    >;

    expect('photoDataUrl' in gestorEntry).toBe(false);
    expect('photoDataUrl' in rhEntry).toBe(false);
  });

  describe('getPhoto', () => {
    it('returns the photo for an rh viewer', async () => {
      const created = await service.create('user-g', 'Gabriela', {
        cid: 'J06.9',
        crm: 'CRM-MG 45213',
        medico: 'Dr. Carlos Mendes',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
      });

      const photo = await service.getPhoto(created.id, 'rh');

      expect(photo).toBe('data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh');
    });

    it('returns null for a gestor viewer, even though the photo exists', async () => {
      const created = await service.create('user-h', 'Helena', {
        cid: 'J06.9',
        crm: 'CRM-MG 45213',
        medico: 'Dr. Carlos Mendes',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
      });

      const photo = await service.getPhoto(created.id, 'gestor');

      expect(photo).toBeNull();
    });

    it('returns null for an rh viewer when the atestado has no photo', async () => {
      const created = await service.create('user-i', 'Igor', {
        cid: 'J06.9',
        crm: 'CRM-MG 45213',
        medico: 'Dr. Carlos Mendes',
        dias: 2,
      });

      const photo = await service.getPhoto(created.id, 'rh');

      expect(photo).toBeNull();
    });

    it('returns null for an id that does not exist, rather than throwing', async () => {
      const photo = await service.getPhoto('never-existed', 'rh');

      expect(photo).toBeNull();
    });
  });

  it('updates the status of an atestado', async () => {
    const created = await service.create('user-d', 'Daniela', {
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });

    const updated = await service.updateStatus(created.id, 'aprovado');

    expect(updated.status).toBe('aprovado');
    expect(notificationsMock.sendDocumentStatusChanged).toHaveBeenCalledWith(
      'atestado',
      'user-d',
      'aprovado',
    );
  });

  it('does not notify when reverting an atestado back to em_analise', async () => {
    const created = await service.create('user-d2', 'Daniela Dois', {
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });
    await service.updateStatus(created.id, 'aprovado');
    notificationsMock.sendDocumentStatusChanged.mockClear();

    const reverted = await service.updateStatus(created.id, 'em_analise');

    expect(reverted.status).toBe('em_analise');
    expect(notificationsMock.sendDocumentStatusChanged).not.toHaveBeenCalled();
  });

  it('persists the reviewNote when recusando an atestado', async () => {
    const created = await service.create('user-e', 'Elisa', {
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });

    const updated = await service.updateStatus(
      created.id,
      'recusado',
      'Documento ilegível',
    );

    expect(updated.status).toBe('recusado');
    expect(updated.reviewNote).toBe('Documento ilegível');
  });
});
