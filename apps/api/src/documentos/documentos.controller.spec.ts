import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'listPayslips',
  'createAdmissionDocument',
  'listAdmissionDocuments',
  'createCertification',
  'listCertifications',
  'listAllAdmissionDocuments',
  'listAllCertifications',
  'createPayslip',
  'updatePayslip',
  'removePayslip',
  'listAllPayslips',
  'getAdmissionDocumentPhotos',
  'updateAdmissionDocumentStatus',
  'submitSignedContract',
  'getMySignedContract',
  'listTeamSignedContracts',
  'getSignedContractFile',
  'getPayslipFile',
] as const;

describe('DocumentosController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it.each([
    'listAllAdmissionDocuments',
    'listAllCertifications',
    'createPayslip',
    'updatePayslip',
    'removePayslip',
    'listAllPayslips',
    'updateAdmissionDocumentStatus',
    'listTeamSignedContracts',
  ] as const)('applies RolesGuard(gestor, rh) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('does NOT apply RolesGuard or a role restriction to listPayslips (self-service)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype.listPayslips,
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype.listPayslips,
    ) as unknown[] | undefined;

    expect(guards).not.toContain(RolesGuard);
    expect(roles).toBeUndefined();
  });
});

describe('DocumentosController', () => {
  let controller: DocumentosController;
  const serviceMock = {
    listPayslips: jest.fn(),
    createAdmissionDocument: jest.fn(),
    listAdmissionDocuments: jest.fn(),
    createCertification: jest.fn(),
    listCertifications: jest.fn(),
    listAllAdmissionDocuments: jest.fn(),
    listAllCertifications: jest.fn(),
    createPayslip: jest.fn(),
    updatePayslip: jest.fn(),
    deletePayslip: jest.fn(),
    listAllPayslips: jest.fn(),
    getAdmissionDocumentPhotos: jest.fn(),
    updateAdmissionDocumentStatus: jest.fn(),
    submitSignedContract: jest.fn(),
    getMySignedContract: jest.fn(),
    listTeamSignedContracts: jest.fn(),
    getSignedContractFile: jest.fn(),
    getPayslipFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosController],
      providers: [{ provide: DocumentosService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DocumentosController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  const PHOTO_DATA_URL = 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh';

  it('creates an admission document for the authenticated user', async () => {
    serviceMock.createAdmissionDocument.mockResolvedValue({ id: '1' });

    await controller.createAdmissionDocument(
      { kind: 'rg', photos: [PHOTO_DATA_URL] },
      requestAs('user-1'),
    );

    expect(serviceMock.createAdmissionDocument).toHaveBeenCalledWith('user-1', 'Test User', {
      kind: 'rg',
      photos: [PHOTO_DATA_URL],
    });
  });

  it('fetches admission document photos for the authenticated user', async () => {
    serviceMock.getAdmissionDocumentPhotos.mockResolvedValue([PHOTO_DATA_URL]);

    const result = await controller.getAdmissionDocumentPhotos('adm-1', requestAs('user-1'));

    expect(result).toEqual({ photos: [PHOTO_DATA_URL] });
    expect(serviceMock.getAdmissionDocumentPhotos).toHaveBeenCalledWith('adm-1', 'colaborador', 'user-1');
  });

  it('returns an empty photo list when the service finds nothing', async () => {
    serviceMock.getAdmissionDocumentPhotos.mockResolvedValue(null);

    const result = await controller.getAdmissionDocumentPhotos('adm-missing', requestAs('user-1'));

    expect(result).toEqual({ photos: [] });
  });

  it('updates an admission document status with a valid payload', async () => {
    serviceMock.updateAdmissionDocumentStatus.mockResolvedValue({ id: 'adm-1', status: 'aprovado' });

    await controller.updateAdmissionDocumentStatus('adm-1', { status: 'aprovado' });

    expect(serviceMock.updateAdmissionDocumentStatus).toHaveBeenCalledWith('adm-1', 'aprovado', undefined);
  });

  it('rejects an admission document reprovado without a reviewNote', async () => {
    await expect(
      controller.updateAdmissionDocumentStatus('adm-1', { status: 'recusado' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateAdmissionDocumentStatus).not.toHaveBeenCalled();
  });

  it('rejects a kind outside the fixed list', async () => {
    await expect(
      controller.createAdmissionDocument(
        { kind: 'passaporte', photos: [PHOTO_DATA_URL] },
        requestAs('user-1'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createAdmissionDocument).not.toHaveBeenCalled();
  });

  it('rejects an admission document with no photos', async () => {
    await expect(
      controller.createAdmissionDocument({ kind: 'rg', photos: [] }, requestAs('user-1')),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createAdmissionDocument).not.toHaveBeenCalled();
  });

  it('creates a certification for the authenticated user', async () => {
    serviceMock.createCertification.mockResolvedValue({ id: '1' });

    await controller.createCertification(
      {
        name: 'AWS Certified',
        institution: 'Amazon',
        validUntil: '10/10/2028',
      },
      requestAs('user-1'),
    );

    expect(serviceMock.createCertification).toHaveBeenCalledWith('user-1', {
      name: 'AWS Certified',
      institution: 'Amazon',
      validUntil: '10/10/2028',
    });
  });

  it('rejects a certification with a malformed date', async () => {
    await expect(
      controller.createCertification(
        {
          name: 'AWS Certified',
          institution: 'Amazon',
          validUntil: '2028-10-10',
        },
        requestAs('user-1'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createCertification).not.toHaveBeenCalled();
  });

  it('lists admission documents across the whole team', async () => {
    serviceMock.listAllAdmissionDocuments.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listAllAdmissionDocuments();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
    expect(serviceMock.listAllAdmissionDocuments).toHaveBeenCalledWith();
  });

  it('lists certifications across the whole team', async () => {
    serviceMock.listAllCertifications.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listAllCertifications();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
    expect(serviceMock.listAllCertifications).toHaveBeenCalledWith();
  });

  it('creates a payslip with a valid payload', async () => {
    serviceMock.createPayslip.mockResolvedValue({ id: '1' });

    await controller.createPayslip({
      userId: 'user-1',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });

    expect(serviceMock.createPayslip).toHaveBeenCalledWith({
      userId: 'user-1',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });
  });

  it('rejects a payslip payload missing userId', async () => {
    await expect(
      controller.createPayslip({
        label: 'Agosto/2026',
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPayslip).not.toHaveBeenCalled();
  });

  it('rejects a payslip payload with a negative value', async () => {
    await expect(
      controller.createPayslip({
        userId: 'user-1',
        label: 'Agosto/2026',
        gross: -1,
        inss: 682,
        irrf: 410,
        benefits: 380,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPayslip).not.toHaveBeenCalled();
  });

  it('updates a payslip with a valid payload, without a userId field', async () => {
    serviceMock.updatePayslip.mockResolvedValue({ id: 'p1' });

    await controller.updatePayslip('p1', {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });

    expect(serviceMock.updatePayslip).toHaveBeenCalledWith('p1', {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });
  });

  it('deletes a payslip', async () => {
    serviceMock.deletePayslip.mockResolvedValue(undefined);

    await controller.removePayslip('p1');

    expect(serviceMock.deletePayslip).toHaveBeenCalledWith('p1');
  });

  it('lists payslips across the whole team', async () => {
    serviceMock.listAllPayslips.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listAllPayslips();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
  });

  const PDF_DATA_URL = 'data:application/pdf;base64,ZmFrZS1wZGYtZGF0YQ==';

  it('submits a signed contract for the authenticated user, never trusting a body userId', async () => {
    serviceMock.submitSignedContract.mockResolvedValue({ submittedAt: new Date('2026-09-07') });

    await controller.submitSignedContract(
      { fileDataUrl: PDF_DATA_URL, userId: 'someone-else' },
      requestAs('user-1'),
    );

    expect(serviceMock.submitSignedContract).toHaveBeenCalledWith('user-1', 'Test User', PDF_DATA_URL);
  });

  it('rejects a signed contract body that is not a PDF data URL', async () => {
    await expect(
      controller.submitSignedContract({ fileDataUrl: PHOTO_DATA_URL }, requestAs('user-1')),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.submitSignedContract).not.toHaveBeenCalled();
  });

  it("gets the authenticated user's own signed contract status", async () => {
    serviceMock.getMySignedContract.mockResolvedValue({ submittedAt: new Date('2026-09-07') });

    await controller.getMySignedContract(requestAs('user-1'));

    expect(serviceMock.getMySignedContract).toHaveBeenCalledWith('user-1');
  });

  it('lists signed contract status across the whole team', async () => {
    serviceMock.listTeamSignedContracts.mockResolvedValue([
      { userId: 'user-1', userName: 'Ana', submittedAt: null },
    ]);

    const result = await controller.listTeamSignedContracts();

    expect(result).toEqual([{ userId: 'user-1', userName: 'Ana', submittedAt: null }]);
  });

  it('fetches a signed contract file, passing the viewer role/id through to the service', async () => {
    serviceMock.getSignedContractFile.mockResolvedValue(PDF_DATA_URL);

    const result = await controller.getSignedContractFile('user-2', requestAs('user-1'));

    expect(result).toEqual({ fileDataUrl: PDF_DATA_URL });
    expect(serviceMock.getSignedContractFile).toHaveBeenCalledWith('user-2', 'colaborador', 'user-1');
  });

  function responseMock() {
    return { set: jest.fn(), send: jest.fn() } as unknown as import('express').Response;
  }

  it('streams a payslip PDF with the right headers, passing the viewer role/id through to the service', async () => {
    const pdfBuffer = Buffer.from('%PDF-fake');
    serviceMock.getPayslipFile.mockResolvedValue(pdfBuffer);
    const res = responseMock();

    await controller.getPayslipFile('p1', requestAs('user-1'), res);

    expect(serviceMock.getPayslipFile).toHaveBeenCalledWith('p1', 'colaborador', 'user-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="holerite.pdf"',
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(res.send).toHaveBeenCalledWith(pdfBuffer);
  });

  it('throws NotFoundException, without writing a response, when the service finds nothing', async () => {
    serviceMock.getPayslipFile.mockResolvedValue(null);
    const res = responseMock();

    await expect(controller.getPayslipFile('missing', requestAs('user-1'), res)).rejects.toThrow(
      'Holerite não encontrado.',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(res.send).not.toHaveBeenCalled();
  });
});
