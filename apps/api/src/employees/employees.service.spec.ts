process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmployeesService avatar self-service', () => {
  let service: EmployeesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeesService, PrismaService],
    }).compile();

    service = module.get(EmployeesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-avatar-' } } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  const PHOTO_DATA_URL = 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh';

  describe('getMyAvatar', () => {
    it('returns null when the employee has no avatar set', async () => {
      await prisma.employee.create({
        data: { userId: 'user-avatar-1', name: 'Ana', role: 'colaborador', hireDate: new Date('2024-01-01') },
      });

      expect(await service.getMyAvatar('user-avatar-1')).toBeNull();
    });

    it('returns the stored avatar', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-avatar-2',
          name: 'Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          avatarDataUrl: PHOTO_DATA_URL,
        },
      });

      expect(await service.getMyAvatar('user-avatar-2')).toBe(PHOTO_DATA_URL);
    });
  });

  describe('setMyAvatar', () => {
    it('saves the photo and returns it', async () => {
      await prisma.employee.create({
        data: { userId: 'user-avatar-3', name: 'Ana', role: 'colaborador', hireDate: new Date('2024-01-01') },
      });

      const result = await service.setMyAvatar('user-avatar-3', PHOTO_DATA_URL);

      expect(result).toBe(PHOTO_DATA_URL);
      const updated = await prisma.employee.findUniqueOrThrow({ where: { userId: 'user-avatar-3' } });
      expect(updated.avatarDataUrl).toBe(PHOTO_DATA_URL);
    });

    it('replaces a previously set photo', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-avatar-4',
          name: 'Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          avatarDataUrl: PHOTO_DATA_URL,
        },
      });
      const newPhoto = 'data:image/png;base64,b3V0cmEtaW1hZ2Vt';

      await service.setMyAvatar('user-avatar-4', newPhoto);

      const updated = await prisma.employee.findUniqueOrThrow({ where: { userId: 'user-avatar-4' } });
      expect(updated.avatarDataUrl).toBe(newPhoto);
    });
  });

  describe('removeMyAvatar', () => {
    it('clears a previously set photo', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-avatar-5',
          name: 'Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          avatarDataUrl: PHOTO_DATA_URL,
        },
      });

      await service.removeMyAvatar('user-avatar-5');

      const updated = await prisma.employee.findUniqueOrThrow({ where: { userId: 'user-avatar-5' } });
      expect(updated.avatarDataUrl).toBeNull();
    });
  });
});

describe('EmployeesService personal-data self-service', () => {
  let service: EmployeesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeesService, PrismaService],
    }).compile();

    service = module.get(EmployeesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-mypd-' } } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  describe('getMyPersonalData', () => {
    it('returns only the self-service fields, not contractual ones', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-mypd-1',
          name: 'Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          salarioMensal: 9999,
          rg: '111222333',
          phone: '11987654321',
        },
      });

      const result = await service.getMyPersonalData('user-mypd-1');

      expect(result).toEqual({
        rg: '111222333',
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
        phone: '11987654321',
      });
      expect(result).not.toHaveProperty('salarioMensal');
      expect(result).not.toHaveProperty('name');
    });
  });

  describe('updateMyPersonalData', () => {
    it('writes only the self-service fields, leaving contractual fields untouched', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-mypd-2',
          name: 'Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cargo: 'desenvolvedor',
          salarioMensal: 5000,
        },
      });

      await service.updateMyPersonalData('user-mypd-2', {
        rg: '999888777',
        dataNascimento: '1995-03-10',
        estadoCivil: 'casado',
        enderecoRua: 'Rua Nova',
        enderecoNumero: '42',
        enderecoBairro: 'Jardins',
        enderecoCidade: 'São Paulo',
        enderecoEstado: 'SP',
        enderecoCep: '01310100',
        phone: '11912345678',
      });

      const updated = await prisma.employee.findUniqueOrThrow({ where: { userId: 'user-mypd-2' } });
      expect(updated.rg).toBe('999888777');
      expect(updated.dataNascimento).toEqual(new Date('1995-03-10'));
      expect(updated.estadoCivil).toBe('casado');
      expect(updated.enderecoRua).toBe('Rua Nova');
      expect(updated.phone).toBe('11912345678');
      // Untouched — this method never writes them.
      expect(updated.cargo).toBe('desenvolvedor');
      expect(updated.salarioMensal).toBe(5000);
    });

    it('clears fields back to null', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-mypd-3',
          name: 'Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          rg: '111222333',
          phone: '11987654321',
        },
      });

      await service.updateMyPersonalData('user-mypd-3', {
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
        phone: null,
      });

      const updated = await prisma.employee.findUniqueOrThrow({ where: { userId: 'user-mypd-3' } });
      expect(updated.rg).toBeNull();
      expect(updated.phone).toBeNull();
    });
  });
});

describe('EmployeesService.updateTipoContratacao', () => {
  let service: EmployeesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeesService, PrismaService],
    }).compile();

    service = module.get(EmployeesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'emp-test-tipo-' } } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('sets tipoContratacao on the employee row', async () => {
    const created = await prisma.employee.create({
      data: { userId: 'emp-test-tipo-1', name: 'Teste Tipo', role: 'colaborador', hireDate: new Date('2025-01-01') },
    });

    const updated = await service.updateTipoContratacao(created.userId, 'PJ');

    expect(updated.tipoContratacao).toBe('PJ');
  });

  it('accepts null to revert to não-classificado', async () => {
    const created = await prisma.employee.create({
      data: { userId: 'emp-test-tipo-2', name: 'Teste Tipo 2', role: 'colaborador', hireDate: new Date('2025-01-01'), tipoContratacao: 'CLT' },
    });

    const updated = await service.updateTipoContratacao(created.userId, null);

    expect(updated.tipoContratacao).toBeNull();
  });
});
