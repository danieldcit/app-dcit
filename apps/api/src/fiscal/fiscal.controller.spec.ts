import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('FiscalController guard metadata', () => {
  it('applies AuthGuard and RolesGuard to getDashboard, restricted to gestor', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      FiscalController.prototype.getDashboard,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      FiscalController.prototype.getDashboard,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor']);
  });

  it('applies AuthGuard and RolesGuard to getParametros, restricted to gestor', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      FiscalController.prototype.getParametros,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor']);
  });

  it('applies AuthGuard and RolesGuard to updateParametros, restricted to gestor', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      FiscalController.prototype.updateParametros,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor']);
  });
});

describe('FiscalController', () => {
  let controller: FiscalController;
  const serviceMock = {
    getDashboard: jest.fn(),
    getParametros: jest.fn(),
    updateParametros: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FiscalController],
      providers: [{ provide: FiscalService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FiscalController);
  });

  it('passes team and tipoContratacao query params to the service', async () => {
    serviceMock.getDashboard.mockResolvedValue({ headcountTotal: 0 });

    await controller.getDashboard('fiscal-team', 'CLT');

    expect(serviceMock.getDashboard).toHaveBeenCalledWith({ team: 'fiscal-team', tipoContratacao: 'CLT' });
  });

  it('returns the stored parameters', async () => {
    serviceMock.getParametros.mockResolvedValue({ id: 'default' });

    const result = await controller.getParametros();

    expect(result).toEqual({ id: 'default' });
  });

  const VALID_BODY = {
    inssPatronalPercent: 20,
    ratPercent: 2,
    terceirosPercent: 5.8,
    fgtsPercent: 8,
    sujeitoDesoneracaoFolha: false,
    fonteLegal: 'Lei 8.212/1991',
    vigenciaData: '2026-01-01',
  };

  it('updates parameters with a valid payload, using req.user.sub', async () => {
    serviceMock.updateParametros.mockResolvedValue({ id: 'default' });
    const req = { user: { sub: 'gestor-1' } } as any;

    await controller.updateParametros(VALID_BODY, req);

    expect(serviceMock.updateParametros).toHaveBeenCalledWith(
      expect.objectContaining({ inssPatronalPercent: 20, ratPercent: 2 }),
      'gestor-1',
    );
  });

  it('rejects an invalid payload before calling the service', async () => {
    const req = { user: { sub: 'gestor-1' } } as any;
    await expect(controller.updateParametros({ ...VALID_BODY, ratPercent: 9 }, req)).rejects.toThrow(
      BadRequestException,
    );
    expect(serviceMock.updateParametros).not.toHaveBeenCalled();
  });
});
