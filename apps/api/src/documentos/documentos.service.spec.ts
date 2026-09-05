process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { DocumentosService } from './documentos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { NotificationsService } from '../notifications/notifications.service';

const PHOTO_DATA_URL = 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh';

describe('DocumentosService', () => {
  let service: DocumentosService;
  let prisma: PrismaService;
  const pushMock = { sendToUser: jest.fn() };
  const notificationsMock = {
    sendDocumentSubmitted: jest.fn(),
    sendDocumentStatusChanged: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentosService,
        PrismaService,
        { provide: ExpoPushService, useValue: pushMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get(DocumentosService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.payslip.deleteMany();
    await prisma.admissionDocument.deleteMany();
    await prisma.certification.deleteMany();
    await prisma.notification.deleteMany({ where: { type: 'holerite' } });
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-e', 'user-f'] } },
    });
    await prisma.onModuleDestroy();
  });

  it("lists only the given user's payslips", async () => {
    await prisma.payslip.createMany({
      data: [
        {
          userId: 'user-a',
          label: 'Julho 2026',
          gross: 6200,
          inss: 682,
          irrf: 410,
          benefits: 380,
        },
        {
          userId: 'user-b',
          label: 'Julho 2026',
          gross: 5000,
          inss: 500,
          irrf: 300,
          benefits: 200,
        },
      ],
    });

    const results = await service.listPayslips('user-a');

    expect(results).toHaveLength(1);
    expect(results[0].gross).toBe(6200);
  });

  it('creates, updates, and lists a payslip across the whole team', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-g',
        name: 'Gabriela Holerite',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });

    const created = await service.createPayslip({
      userId: 'user-g',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });

    expect(created.label).toBe('Agosto/2026');
    expect(created.gross).toBe(6200);

    const notification = await prisma.notification.findFirst({
      where: { userId: 'user-g', type: 'holerite' },
    });
    expect(notification?.message).toBe('Novo holerite disponível: Agosto/2026.');
    expect(notification?.link).toBe('/holerites');
    expect(pushMock.sendToUser).toHaveBeenCalledWith(
      'user-g',
      expect.objectContaining({ body: 'Novo holerite disponível: Agosto/2026.' }),
    );

    const listed = await service.listAllPayslips();
    expect(listed.find((p) => p.id === created.id)?.userName).toBe(
      'Gabriela Holerite',
    );

    const updated = await service.updatePayslip(created.id, {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });
    expect(updated.label).toBe('Agosto/2026 (corrigido)');
    expect(updated.gross).toBe(6500);

    await prisma.employee.delete({ where: { userId: 'user-g' } });
  });

  it('throws NotFoundException when updating a payslip that does not exist', async () => {
    await expect(
      service.updatePayslip('never-existed', {
        label: 'X',
        gross: 100,
        inss: 10,
        irrf: 10,
        benefits: 10,
      }),
    ).rejects.toThrow('Holerite não encontrado.');
  });

  it('deletes a payslip idempotently', async () => {
    const created = await service.createPayslip({
      userId: 'user-h',
      label: 'Setembro/2026',
      gross: 5000,
      inss: 500,
      irrf: 300,
      benefits: 200,
    });

    await service.deletePayslip(created.id);
    // Calling it a second time, or on an id that never existed, must not throw.
    await service.deletePayslip(created.id);
    await service.deletePayslip('never-existed');

    const listed = await service.listAllPayslips();
    expect(listed.find((p) => p.id === created.id)).toBeUndefined();
  });

  it('creates and lists admission documents scoped to the user, deriving the title from kind', async () => {
    await service.createAdmissionDocument('user-c', 'Carla Colaboradora', {
      kind: 'comprovante_endereco',
      photos: [PHOTO_DATA_URL],
    });

    const results = await service.listAdmissionDocuments('user-c');

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('comprovante_endereco');
    expect(results[0].title).toBe('Comprovante de endereço');
    expect(results[0].status).toBe('enviado');
    expect(results[0]).not.toHaveProperty('photoUri');
  });

  it('notifies gestor/rh after creating an admission document', async () => {
    await service.createAdmissionDocument('user-notify-doc', 'Diana Documentos', {
      kind: 'rg',
      photos: [PHOTO_DATA_URL],
    });

    expect(notificationsMock.sendDocumentSubmitted).toHaveBeenCalledWith(
      'admissional',
      'user-notify-doc',
      'Diana Documentos',
    );
  });

  it('resubmitting the same kind replaces the photos and resets status instead of creating a second row', async () => {
    const first = await service.createAdmissionDocument('user-resubmit', 'Rita Resubmit', {
      kind: 'cpf',
      photos: [PHOTO_DATA_URL],
    });
    await service.updateAdmissionDocumentStatus(first.id, 'recusado', 'Foto cortada');

    const OTHER_PHOTO = 'data:image/png;base64,b3V0cmEtZm90bw==';
    const resubmitted = await service.createAdmissionDocument('user-resubmit', 'Rita Resubmit', {
      kind: 'cpf',
      photos: [OTHER_PHOTO],
    });

    expect(resubmitted.id).toBe(first.id);
    expect(resubmitted.status).toBe('enviado');
    expect(resubmitted.reviewNote).toBeNull();

    const results = await service.listAdmissionDocuments('user-resubmit');
    expect(results.filter((r) => r.kind === 'cpf')).toHaveLength(1);
  });

  describe('updateAdmissionDocumentStatus', () => {
    it('sets status/reviewNote and notifies the owner', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-2', 'Diego Documentos', {
        kind: 'certidao_casamento',
        photos: [PHOTO_DATA_URL],
      });

      const updated = await service.updateAdmissionDocumentStatus(created.id, 'recusado', 'Foto ilegível');

      expect(updated.status).toBe('recusado');
      expect(updated.reviewNote).toBe('Foto ilegível');
      expect(notificationsMock.sendDocumentStatusChanged).toHaveBeenCalledWith(
        'admissional',
        'user-notify-doc-2',
        'recusado',
      );
    });

    it('does not notify when reverting to em_analise', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-2b', 'Dara Documentos', {
        kind: 'certidao_casamento',
        photos: [PHOTO_DATA_URL],
      });
      await service.updateAdmissionDocumentStatus(created.id, 'aprovado');
      notificationsMock.sendDocumentStatusChanged.mockClear();

      const reverted = await service.updateAdmissionDocumentStatus(created.id, 'em_analise');

      expect(reverted.status).toBe('em_analise');
      expect(notificationsMock.sendDocumentStatusChanged).not.toHaveBeenCalled();
    });
  });

  describe('getAdmissionDocumentPhotos', () => {
    it('returns only the populated photo slots, in order', async () => {
      const PHOTO_2 = 'data:image/png;base64,c2Vjb25kLXBob3Rv';
      const created = await service.createAdmissionDocument('user-notify-doc-3', 'Duda Documentos', {
        kind: 'rg',
        photos: [PHOTO_DATA_URL, PHOTO_2],
      });

      const photos = await service.getAdmissionDocumentPhotos(created.id, 'gestor', 'someone-else');

      expect(photos).toEqual([PHOTO_DATA_URL, PHOTO_2]);
    });

    it('lets a gestor (not just rh) view the photos', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-3b', 'Duda Documentos', {
        kind: 'rg',
        photos: [PHOTO_DATA_URL],
      });

      const photos = await service.getAdmissionDocumentPhotos(created.id, 'gestor', 'someone-else');

      expect(photos).toEqual([PHOTO_DATA_URL]);
    });

    it('lets the owner view their own photos', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-4', 'Dora Documentos', {
        kind: 'rg',
        photos: [PHOTO_DATA_URL],
      });

      const photos = await service.getAdmissionDocumentPhotos(created.id, 'colaborador', 'user-notify-doc-4');

      expect(photos).toEqual([PHOTO_DATA_URL]);
    });

    it('blocks a third-party colaborador', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-5', 'Duarte Documentos', {
        kind: 'rg',
        photos: [PHOTO_DATA_URL],
      });

      const photos = await service.getAdmissionDocumentPhotos(created.id, 'colaborador', 'someone-else');

      expect(photos).toBeNull();
    });
  });

  it('creates and lists certifications scoped to the user, parsing the DD/MM/AAAA date', async () => {
    await service.createCertification('user-d', {
      name: 'AWS Certified',
      institution: 'Amazon',
      validUntil: '10/10/2028',
    });

    const results = await service.listCertifications('user-d');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('AWS Certified');
    expect(results[0].validUntil.toISOString().slice(0, 10)).toBe('2028-10-10');
  });

  it('lists admission documents across every user, joined with the employee name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-e',
        name: 'Ester Admissional',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await service.createAdmissionDocument('user-e', 'Ester Admissional', {
      kind: 'rg',
      photos: [PHOTO_DATA_URL],
    });

    const results = await service.listAllAdmissionDocuments();

    expect(results.find((r) => r.userId === 'user-e')?.userName).toBe(
      'Ester Admissional',
    );
  });

  it('lists certifications across every user, joined with the employee name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-f',
        name: 'Fábio Certificado',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await service.createCertification('user-f', {
      name: 'Scrum Master',
      institution: 'Scrum.org',
      validUntil: '05/05/2029',
    });

    const results = await service.listAllCertifications();

    expect(results.find((r) => r.userId === 'user-f')?.userName).toBe(
      'Fábio Certificado',
    );
  });
});
