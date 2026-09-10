import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('NotificationsController guard metadata', () => {
  it('restricts sendPagamento to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.sendPagamento,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.sendPagamento,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('restricts pagamentoStatus to rh only', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.pagamentoStatus,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies only AuthGuard (no role restriction) to listMine', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.listMine,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies only AuthGuard (no role restriction) to markRead', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.markRead,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies only AuthGuard (no role restriction) to markAllRead', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.markAllRead,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });
});

describe('NotificationsController.pagamentoStatus', () => {
  let controller: NotificationsController;
  const serviceMock = {
    sendPagamento: jest.fn(),
    pagamentoStatus: jest.fn(),
    listMine: jest.fn(),
    markRead: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(NotificationsController);
  });

  it('calls through to the service with the parsed start/end for a valid query', async () => {
    serviceMock.pagamentoStatus.mockResolvedValue([{ userId: 'user-1', sentAt: '2026-09-05T12:00:00.000Z' }]);

    const result = await controller.pagamentoStatus('salario', {
      start: '2026-09-01',
      end: '2026-09-30',
    });

    expect(serviceMock.pagamentoStatus).toHaveBeenCalledWith('salario', '2026-09-01', '2026-09-30');
    expect(result).toEqual([{ userId: 'user-1', sentAt: '2026-09-05T12:00:00.000Z' }]);
  });

  it('rejects an invalid category before calling the service', () => {
    expect(() =>
      controller.pagamentoStatus('nao-existe', { start: '2026-09-01', end: '2026-09-30' }),
    ).toThrow(BadRequestException);
    expect(serviceMock.pagamentoStatus).not.toHaveBeenCalled();
  });

  it('rejects a query missing start', () => {
    expect(() =>
      controller.pagamentoStatus('salario', { end: '2026-09-30' }),
    ).toThrow(BadRequestException);
    expect(serviceMock.pagamentoStatus).not.toHaveBeenCalled();
  });

  it('rejects a query missing end', () => {
    expect(() =>
      controller.pagamentoStatus('salario', { start: '2026-09-01' }),
    ).toThrow(BadRequestException);
    expect(serviceMock.pagamentoStatus).not.toHaveBeenCalled();
  });

  it('rejects a malformed date format', () => {
    expect(() =>
      controller.pagamentoStatus('salario', { start: '09/01/2026', end: '2026-09-30' }),
    ).toThrow(BadRequestException);
    expect(serviceMock.pagamentoStatus).not.toHaveBeenCalled();
  });

  it('rejects start after end with the expected message', () => {
    expect(() =>
      controller.pagamentoStatus('salario', { start: '2026-09-30', end: '2026-09-01' }),
    ).toThrow('O parâmetro start não pode ser posterior a end.');
    expect(serviceMock.pagamentoStatus).not.toHaveBeenCalled();
  });
});
