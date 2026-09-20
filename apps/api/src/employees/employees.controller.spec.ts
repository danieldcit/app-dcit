import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('EmployeesController guard metadata', () => {
  it('applies AuthGuard and RolesGuard to list, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.list,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.list,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to updateSchedule, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateSchedule,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateSchedule,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to create, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.create,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.create,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to listTrash, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.listTrash,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.listTrash,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to softDelete, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.softDelete,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.softDelete,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to restore, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.restore,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.restore,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to permanentlyDelete, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.permanentlyDelete,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.permanentlyDelete,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to updatePersonalData, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updatePersonalData,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updatePersonalData,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies only AuthGuard (no role restriction) to getMyAvatar', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.getMyAvatar,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies only AuthGuard (no role restriction) to setMyAvatar', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.setMyAvatar,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies only AuthGuard (no role restriction) to removeMyAvatar', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.removeMyAvatar,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies only AuthGuard (no role restriction) to getMyPersonalData', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.getMyPersonalData,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies only AuthGuard (no role restriction) to updateMyPersonalData', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateMyPersonalData,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies AuthGuard and RolesGuard to updateTipoContratacao, restricted to gestor', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateTipoContratacao,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateTipoContratacao,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor']);
  });
});

describe('EmployeesController', () => {
  let controller: EmployeesController;
  const serviceMock = {
    list: jest.fn(),
    updateSchedule: jest.fn(),
    create: jest.fn(),
    listTrash: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    permanentlyDelete: jest.fn(),
    updatePersonalData: jest.fn(),
    getMyAvatar: jest.fn(),
    setMyAvatar: jest.fn(),
    removeMyAvatar: jest.fn(),
    getMyPersonalData: jest.fn(),
    updateMyPersonalData: jest.fn(),
    updateTipoContratacao: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [{ provide: EmployeesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EmployeesController);
  });

  const PHOTO_DATA_URL = 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh';
  const AUTH_REQ = { user: { sub: 'user-1', role: 'colaborador', name: 'Ana' } } as never;

  it('returns the caller\'s avatar', async () => {
    serviceMock.getMyAvatar.mockResolvedValue(PHOTO_DATA_URL);

    const result = await controller.getMyAvatar(AUTH_REQ);

    expect(result).toEqual({ photo: PHOTO_DATA_URL });
    expect(serviceMock.getMyAvatar).toHaveBeenCalledWith('user-1');
  });

  it('sets the avatar with a valid payload', async () => {
    serviceMock.setMyAvatar.mockResolvedValue(PHOTO_DATA_URL);

    const result = await controller.setMyAvatar({ photo: PHOTO_DATA_URL }, AUTH_REQ);

    expect(result).toEqual({ photo: PHOTO_DATA_URL });
    expect(serviceMock.setMyAvatar).toHaveBeenCalledWith('user-1', PHOTO_DATA_URL);
  });

  it('rejects an invalid avatar payload before calling the service', async () => {
    await expect(
      controller.setMyAvatar({ photo: 'file:///local.jpg' }, AUTH_REQ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.setMyAvatar).not.toHaveBeenCalled();
  });

  it('removes the avatar', async () => {
    serviceMock.removeMyAvatar.mockResolvedValue(undefined);

    await controller.removeMyAvatar(AUTH_REQ);

    expect(serviceMock.removeMyAvatar).toHaveBeenCalledWith('user-1');
  });

  const VALID_PERSONAL_DATA = {
    rg: '111222333',
    dataNascimento: '1995-03-10',
    estadoCivil: 'casado',
    enderecoRua: 'Rua Nova',
    enderecoNumero: '42',
    enderecoBairro: 'Jardins',
    enderecoCidade: 'São Paulo',
    enderecoEstado: 'SP',
    enderecoCep: '01310100',
    phone: '11912345678',
  };

  it('returns the caller\'s personal data', async () => {
    serviceMock.getMyPersonalData.mockResolvedValue(VALID_PERSONAL_DATA);

    const result = await controller.getMyPersonalData(AUTH_REQ);

    expect(result).toEqual(VALID_PERSONAL_DATA);
    expect(serviceMock.getMyPersonalData).toHaveBeenCalledWith('user-1');
  });

  it('updates the personal data with a valid payload', async () => {
    serviceMock.updateMyPersonalData.mockResolvedValue(VALID_PERSONAL_DATA);

    const result = await controller.updateMyPersonalData(VALID_PERSONAL_DATA, AUTH_REQ);

    expect(result).toEqual(VALID_PERSONAL_DATA);
    expect(serviceMock.updateMyPersonalData).toHaveBeenCalledWith('user-1', VALID_PERSONAL_DATA);
  });

  it('rejects a payload with an invalid enderecoEstado before calling the service', async () => {
    await expect(
      controller.updateMyPersonalData({ ...VALID_PERSONAL_DATA, enderecoEstado: 'ZZ' }, AUTH_REQ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateMyPersonalData).not.toHaveBeenCalled();
  });

  it('rejects a payload missing a required key before calling the service', async () => {
    const { phone: _phone, ...incomplete } = VALID_PERSONAL_DATA;
    await expect(controller.updateMyPersonalData(incomplete, AUTH_REQ)).rejects.toThrow(
      BadRequestException,
    );
    expect(serviceMock.updateMyPersonalData).not.toHaveBeenCalled();
  });

  it('returns the employee roster', async () => {
    serviceMock.list.mockResolvedValue([{ userId: 'user-1', name: 'Ana' }]);

    const result = await controller.list();

    expect(result).toEqual([{ userId: 'user-1', name: 'Ana' }]);
    expect(serviceMock.list).toHaveBeenCalledWith();
  });

  it('updates the schedule with a valid payload', async () => {
    serviceMock.updateSchedule.mockResolvedValue({
      userId: 'user-1',
      expectedStartTime: '09:00',
    });

    await controller.updateSchedule('user-1', { expectedStartTime: '09:00' });

    expect(serviceMock.updateSchedule).toHaveBeenCalledWith('user-1', {
      expectedStartTime: '09:00',
    });
  });

  it('accepts null to clear the schedule', async () => {
    serviceMock.updateSchedule.mockResolvedValue({
      userId: 'user-1',
      expectedStartTime: null,
    });

    await controller.updateSchedule('user-1', { expectedStartTime: null });

    expect(serviceMock.updateSchedule).toHaveBeenCalledWith('user-1', {
      expectedStartTime: null,
    });
  });

  it('rejects a malformed time before calling the service', async () => {
    await expect(
      controller.updateSchedule('user-1', { expectedStartTime: '9am' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateSchedule).not.toHaveBeenCalled();
  });

  const VALID_CREATE_BODY = {
    name: 'Ana Colaboradora',
    role: 'colaborador',
    email: null,
    cargo: null,
    team: null,
    nivel: null,
    convencaoId: null,
    salarioMensal: null,
    hireDate: '2026-01-15',
    cpf: null,
    rg: null,
    dataNascimento: null,
    estadoCivil: null,
    enderecoRua: null,
    enderecoNumero: null,
    enderecoBairro: null,
    enderecoCidade: null,
    enderecoEstado: null,
    enderecoCep: null,
  };

  it('creates an employee with a valid payload', async () => {
    serviceMock.create.mockResolvedValue({
      userId: 'generated-id',
      ...VALID_CREATE_BODY,
    });

    await controller.create(VALID_CREATE_BODY);

    expect(serviceMock.create).toHaveBeenCalledWith(VALID_CREATE_BODY);
  });

  it('rejects an invalid payload before calling the service', async () => {
    await expect(
      controller.create({ ...VALID_CREATE_BODY, role: 'admin' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it('rejects a payload missing required fields', async () => {
    await expect(controller.create({})).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it('lists trashed employees', async () => {
    serviceMock.listTrash.mockResolvedValue([
      { userId: 'user-1', deletedAt: new Date() },
    ]);

    const result = await controller.listTrash();

    expect(result).toHaveLength(1);
    expect(serviceMock.listTrash).toHaveBeenCalledWith();
  });

  it('soft-deletes an employee', async () => {
    serviceMock.softDelete.mockResolvedValue(undefined);

    await controller.softDelete('user-1');

    expect(serviceMock.softDelete).toHaveBeenCalledWith('user-1');
  });

  it('restores an employee', async () => {
    serviceMock.restore.mockResolvedValue({
      userId: 'user-1',
      deletedAt: null,
    });

    await controller.restore('user-1');

    expect(serviceMock.restore).toHaveBeenCalledWith('user-1');
  });

  it('permanently deletes an employee', async () => {
    serviceMock.permanentlyDelete.mockResolvedValue(undefined);

    await controller.permanentlyDelete('user-1');

    expect(serviceMock.permanentlyDelete).toHaveBeenCalledWith('user-1');
  });

  it('updates personal data with a valid payload', async () => {
    serviceMock.updatePersonalData.mockResolvedValue({
      userId: 'user-1',
      ...VALID_CREATE_BODY,
    });

    await controller.updatePersonalData('user-1', VALID_CREATE_BODY);

    expect(serviceMock.updatePersonalData).toHaveBeenCalledWith(
      'user-1',
      VALID_CREATE_BODY,
    );
  });

  it('rejects an invalid payload before calling the service for updatePersonalData', async () => {
    await expect(
      controller.updatePersonalData('user-1', {
        ...VALID_CREATE_BODY,
        role: 'admin',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updatePersonalData).not.toHaveBeenCalled();
  });

  it('updates tipoContratacao with a valid payload', async () => {
    serviceMock.updateTipoContratacao.mockResolvedValue({ userId: 'u1', tipoContratacao: 'PJ' });

    await controller.updateTipoContratacao('u1', { tipoContratacao: 'PJ' });

    expect(serviceMock.updateTipoContratacao).toHaveBeenCalledWith('u1', 'PJ');
  });

  it('rejects an invalid tipoContratacao value', async () => {
    await expect(controller.updateTipoContratacao('u1', { tipoContratacao: 'estagiario' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
