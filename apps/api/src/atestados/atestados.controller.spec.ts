import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { AtestadosController } from './atestados.controller';
import { AtestadosService } from './atestados.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

describe('AtestadosController guard metadata', () => {
  it('applies AuthGuard to the ocr (POST) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.ocr,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it('applies AuthGuard to the create (POST) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.create,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it('applies AuthGuard to the listMine (GET) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.listMine,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it('applies AuthGuard and RolesGuard(gestor, rh) to the listTeam (GET) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.listTeam,
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.listTeam,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard(rh) — RH only, not gestor — to the getPhoto (GET) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.getPhoto,
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.getPhoto,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard(gestor, rh) to the updateStatus (PATCH) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.updateStatus,
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.updateStatus,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('AtestadosController', () => {
  let controller: AtestadosController;
  const serviceMock = {
    extract: jest.fn(),
    create: jest.fn(),
    listMine: jest.fn(),
    listTeam: jest.fn(),
    getPhoto: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AtestadosController],
      providers: [{ provide: AtestadosService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AtestadosController);
  });

  function requestAs(
    sub: string,
    role: AuthenticatedUser['role'],
  ): Request & {
    user: AuthenticatedUser;
  } {
    return { user: { sub, role, name: 'Test User' } } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('delegates a valid OCR payload to the service', async () => {
    serviceMock.extract.mockResolvedValue({
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });

    const result = await controller.ocr({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/jpeg',
    });

    expect(serviceMock.extract).toHaveBeenCalledWith({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/jpeg',
    });
    expect(result).toEqual({
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });
  });

  it('rejects an invalid OCR payload before calling the service', async () => {
    await expect(
      controller.ocr({ imageBase64: '', mediaType: 'image/jpeg' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.extract).not.toHaveBeenCalled();
  });

  it('creates an atestado for the authenticated user', async () => {
    serviceMock.create.mockResolvedValue({ id: '1' });

    await controller.create(
      {
        cid: 'J06.9',
        crm: 'CRM-MG 45213',
        medico: 'Dr. Carlos Mendes',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
      },
      requestAs('user-1', 'colaborador'),
    );

    expect(serviceMock.create).toHaveBeenCalledWith('user-1', 'Test User', {
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
      photoDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
    });
  });

  it('rejects an invalid atestado payload', async () => {
    await expect(
      controller.create(
        { cid: '', crm: 'CRM-MG 45213', medico: 'Dr. Carlos Mendes', dias: 2 },
        requestAs('user-1', 'colaborador'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it('lists the team view scoped to the viewer role', async () => {
    serviceMock.listTeam.mockResolvedValue([]);

    await controller.listTeam(requestAs('gestor-1', 'gestor'));

    expect(serviceMock.listTeam).toHaveBeenCalledWith('gestor');
  });

  it("delegates getPhoto to the service with the viewer's role", async () => {
    serviceMock.getPhoto.mockResolvedValue('data:image/jpeg;base64,ZmFrZQ==');

    const result = await controller.getPhoto(
      'atestado-1',
      requestAs('rh-1', 'rh'),
    );

    expect(serviceMock.getPhoto).toHaveBeenCalledWith('atestado-1', 'rh');
    expect(result).toEqual({ photoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==' });
  });

  it('rejects an invalid status update payload', async () => {
    await expect(
      controller.updateStatus('1', { status: 'enviado' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('updates the status via the service', async () => {
    serviceMock.updateStatus.mockResolvedValue({ id: '1', status: 'aprovado' });

    await controller.updateStatus('1', { status: 'aprovado' });

    expect(serviceMock.updateStatus).toHaveBeenCalledWith(
      '1',
      'aprovado',
      undefined,
    );
  });

  it('rejects a recusado without a reviewNote', async () => {
    await expect(
      controller.updateStatus('1', { status: 'recusado' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('passes the reviewNote through when recusando an atestado', async () => {
    serviceMock.updateStatus.mockResolvedValue({ id: '1', status: 'recusado' });

    await controller.updateStatus('1', {
      status: 'recusado',
      reviewNote: 'Documento ilegível',
    });

    expect(serviceMock.updateStatus).toHaveBeenCalledWith(
      '1',
      'recusado',
      'Documento ilegível',
    );
  });
});
