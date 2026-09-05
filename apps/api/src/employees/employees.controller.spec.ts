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
});
