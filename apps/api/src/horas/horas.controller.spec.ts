import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { HorasController } from './horas.controller';
import { HorasService } from './horas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

const GUARDED_HANDLERS = ['resumo', 'list', 'lancar', 'remove'] as const;

describe('HorasController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      HorasController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      HorasController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('HorasController', () => {
  let controller: HorasController;
  const serviceMock = {
    resumo: jest.fn(),
    list: jest.fn(),
    lancar: jest.fn(),
    remove: jest.fn(),
  };
  const req = { user: { sub: 'gestor-spec-1', role: 'gestor', name: 'Gestor Spec' } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HorasController],
      providers: [{ provide: HorasService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(HorasController);
  });

  it('rejects an invalid periodo on resumo', async () => {
    await expect(controller.resumo('ano')).rejects.toThrow();
  });

  it('calls service.resumo with a valid periodo', async () => {
    serviceMock.resumo.mockResolvedValue([]);
    await controller.resumo('semana');
    expect(serviceMock.resumo).toHaveBeenCalledWith('semana');
  });

  it('rejects list without userId', async () => {
    await expect(controller.list(undefined, 'mes')).rejects.toThrow('userId é obrigatório');
  });

  it('rejects list with an invalid periodo', async () => {
    await expect(controller.list('user-1', 'ano')).rejects.toThrow();
  });

  it('calls service.list with userId and periodo', async () => {
    serviceMock.list.mockResolvedValue([]);
    await controller.list('user-1', 'dia');
    expect(serviceMock.list).toHaveBeenCalledWith('user-1', 'dia');
  });

  it('rejects an invalid body on lancar', async () => {
    await expect(controller.lancar({ userId: 'user-1' }, req)).rejects.toThrow();
  });

  it('parses a valid body and calls service.lancar with the session gestorId, never the body', async () => {
    serviceMock.lancar.mockResolvedValue({ id: 'entry-1' });
    await controller.lancar(
      { userId: 'user-1', date: '2026-09-03', horasTickets: 6, gestorId: 'someone-else' },
      req,
    );
    expect(serviceMock.lancar).toHaveBeenCalledWith(
      { userId: 'user-1', date: '2026-09-03', horasTickets: 6 },
      'gestor-spec-1',
    );
  });

  it('removes an entry', async () => {
    await controller.remove('entry-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('entry-1');
  });
});
