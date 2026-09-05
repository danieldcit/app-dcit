process.env.DATABASE_URL = 'file:./test.db';

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmployeesService', () => {
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

  afterAll(async () => {
    await prisma.employee.deleteMany({
      where: {
        userId: {
          in: ['emp-b', 'emp-a', 'emp-schedule', 'emp-edit-convencao'],
        },
      },
    });
    await prisma.employee.deleteMany({
      where: { cpf: { in: ['11111111111', '22222222222'] } },
    });
    await prisma.onModuleDestroy();
  });

  it('lists employees sorted by name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'emp-b',
        name: 'Beto',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'emp-a',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    const results = await service.list();

    const names = results
      .filter((e) => ['emp-a', 'emp-b'].includes(e.userId))
      .map((e) => e.name);
    expect(names).toEqual(['Ana', 'Beto']);
  });

  describe('updateSchedule', () => {
    it('sets expectedStartTime and returns the updated employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-schedule',
          name: 'Duda Horário',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      const updated = await service.updateSchedule('emp-schedule', {
        expectedStartTime: '09:00',
      });

      expect(updated.expectedStartTime).toBe('09:00');
      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-schedule' },
      });
      expect(found?.expectedStartTime).toBe('09:00');
    });

    it('clears expectedStartTime when given null', async () => {
      await service.updateSchedule('emp-schedule', { expectedStartTime: null });

      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-schedule' },
      });
      expect(found?.expectedStartTime).toBeNull();
    });
  });

  it('list() includes expectedStartTime for each employee', async () => {
    await prisma.employee.update({
      where: { userId: 'emp-a' },
      data: { expectedStartTime: '08:00' },
    });

    const results = await service.list();

    expect(results.find((e) => e.userId === 'emp-a')?.expectedStartTime).toBe(
      '08:00',
    );
  });

  describe('create', () => {
    it('persists a new employee with a generated userId and all personal fields populated', async () => {
      const created = await service.create({
        name: 'Carlos Novo',
        role: 'colaborador',
        hireDate: '2026-01-15',
        cpf: '11111111111',
        rg: '1234567',
        dataNascimento: '1990-05-20',
        estadoCivil: 'casado',
        enderecoRua: 'Rua das Flores',
        enderecoNumero: '100',
        enderecoBairro: 'Centro',
        enderecoCidade: 'São Paulo',
        enderecoEstado: 'SP',
        enderecoCep: '01310100',
      });

      expect(created.userId).toHaveLength(36); // uuid
      expect(created.name).toBe('Carlos Novo');
      expect(created.cpf).toBe('11111111111');
      expect(created.dataNascimento?.toISOString()).toBe(
        '1990-05-20T00:00:00.000Z',
      );
      expect(created.estadoCivil).toBe('casado');
      expect(created.enderecoEstado).toBe('SP');

      const found = await prisma.employee.findUnique({
        where: { userId: created.userId },
      });
      expect(found?.cpf).toBe('11111111111');
    });

    it('persists a new employee with every personal field null', async () => {
      const created = await service.create({
        name: 'Debora Sem Dados',
        role: 'colaborador',
        hireDate: '2026-02-01',
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
      });

      expect(created.cpf).toBeNull();
      expect(created.dataNascimento).toBeNull();

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('persists convencaoId and salarioMensal', async () => {
      const created = await service.create({
        name: 'Fabio Convenio',
        role: 'colaborador',
        cargo: null,
        team: null,
        nivel: null,
        hireDate: '2026-03-01',
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
        convencaoId: 'convencao-abc',
        salarioMensal: 5000.5,
      });

      expect(created.convencaoId).toBe('convencao-abc');
      expect(created.salarioMensal).toBe(5000.5);

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('throws ConflictException when a second employee reuses an existing CPF', async () => {
      await service.create({
        name: 'Primeiro',
        role: 'colaborador',
        hireDate: '2026-01-01',
        cpf: '22222222222',
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      await expect(
        service.create({
          name: 'Segundo',
          role: 'colaborador',
          hireDate: '2026-01-02',
          cpf: '22222222222',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException with the generic message when the conflicting CPF belongs to an active employee', async () => {
      await service.create({
        name: 'Ativo Original',
        role: 'colaborador',
        hireDate: '2026-01-01',
        cpf: '77777777777',
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      await expect(
        service.create({
          name: 'Segundo Ativo',
          role: 'colaborador',
          hireDate: '2026-01-02',
          cpf: '77777777777',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow('Já existe um colaborador cadastrado com esse CPF.');

      await prisma.employee.deleteMany({ where: { cpf: '77777777777' } });
    });

    it('throws ConflictException pointing to the lixeira when the conflicting CPF belongs to a soft-deleted employee', async () => {
      const trashed = await service.create({
        name: 'Vai Para Lixeira',
        role: 'colaborador',
        hireDate: '2026-01-01',
        cpf: '88888888888',
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });
      await service.softDelete(trashed.userId);

      await expect(
        service.create({
          name: 'Reaproveitando CPF',
          role: 'colaborador',
          hireDate: '2026-01-02',
          cpf: '88888888888',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow(
        'Já existe um colaborador com esse CPF na lixeira — restaure-o ou exclua-o permanentemente antes de reutilizar o CPF.',
      );

      await prisma.employee.deleteMany({ where: { cpf: '88888888888' } });
    });
  });

  describe('email + password login', () => {
    it('sets a bcrypt hash of the dev password when an employee is created with an email', async () => {
      const created = await service.create({
        name: 'Login Novo',
        role: 'colaborador',
        email: 'login.novo@dev.local',
        hireDate: '2026-01-01',
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
      });

      expect(created.email).toBe('login.novo@dev.local');
      expect(created.passwordHash).not.toBeNull();
      expect(bcrypt.compareSync('dev12345', created.passwordHash as string)).toBe(true);

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('leaves passwordHash null when an employee is created without an email', async () => {
      const created = await service.create({
        name: 'Sem Login',
        role: 'colaborador',
        email: null,
        hireDate: '2026-01-01',
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
      });

      expect(created.email).toBeNull();
      expect(created.passwordHash).toBeNull();

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('sets the dev password hash when updatePersonalData adds an email to a passwordless employee', async () => {
      const created = await service.create({
        name: 'Ganha Email',
        role: 'colaborador',
        email: null,
        hireDate: '2026-01-01',
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
      });
      expect(created.passwordHash).toBeNull();

      const updated = await service.updatePersonalData(created.userId, {
        name: 'Ganha Email',
        role: 'colaborador',
        email: 'ganha.email@dev.local',
        hireDate: '2026-01-01',
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
      });

      expect(updated.email).toBe('ganha.email@dev.local');
      expect(updated.passwordHash).not.toBeNull();
      expect(bcrypt.compareSync('dev12345', updated.passwordHash as string)).toBe(true);

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('does not overwrite an existing passwordHash when updatePersonalData resubmits the same email', async () => {
      const created = await service.create({
        name: 'Ja Tem Login',
        role: 'colaborador',
        email: 'ja.tem.login@dev.local',
        hireDate: '2026-01-01',
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
      });
      expect(created.passwordHash).not.toBeNull();

      // Simulate the colaborador having set their own password (e.g. via
      // "esqueci minha senha") — updatePersonalData must never clobber it.
      const customHash = await bcrypt.hash('senha-propria-do-usuario', 10);
      await prisma.employee.update({
        where: { userId: created.userId },
        data: { passwordHash: customHash },
      });

      const updated = await service.updatePersonalData(created.userId, {
        name: 'Ja Tem Login Editado',
        role: 'colaborador',
        email: 'ja.tem.login@dev.local',
        hireDate: '2026-01-01',
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
      });

      expect(updated.passwordHash).toBe(customHash);

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('clears passwordHash when updatePersonalData removes the email', async () => {
      const created = await service.create({
        name: 'Perde Login',
        role: 'colaborador',
        email: 'perde.login@dev.local',
        hireDate: '2026-01-01',
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
      });
      expect(created.passwordHash).not.toBeNull();

      const updated = await service.updatePersonalData(created.userId, {
        name: 'Perde Login',
        role: 'colaborador',
        email: null,
        hireDate: '2026-01-01',
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
      });

      expect(updated.email).toBeNull();
      expect(updated.passwordHash).toBeNull();

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('throws ConflictException with an email-specific message when a second employee reuses an existing email', async () => {
      const first = await service.create({
        name: 'Email Original',
        role: 'colaborador',
        email: 'duplicado@dev.local',
        hireDate: '2026-01-01',
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
      });

      await expect(
        service.create({
          name: 'Email Duplicado',
          role: 'colaborador',
          email: 'duplicado@dev.local',
          hireDate: '2026-01-02',
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
        }),
      ).rejects.toThrow('Já existe um colaborador cadastrado com esse email.');

      await prisma.employee.delete({ where: { userId: first.userId } });
    });

    it('throws ConflictException pointing to the lixeira when the conflicting email belongs to a soft-deleted employee', async () => {
      const trashed = await service.create({
        name: 'Email Vai Para Lixeira',
        role: 'colaborador',
        email: 'lixeira.email@dev.local',
        hireDate: '2026-01-01',
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
      });
      await service.softDelete(trashed.userId);

      await expect(
        service.create({
          name: 'Reaproveitando Email',
          role: 'colaborador',
          email: 'lixeira.email@dev.local',
          hireDate: '2026-01-02',
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
        }),
      ).rejects.toThrow(
        'Já existe um colaborador com esse email na lixeira — restaure-o ou exclua-o permanentemente antes de reutilizar o email.',
      );

      await prisma.employee.deleteMany({ where: { email: 'lixeira.email@dev.local' } });
    });
  });

  describe('listTrash / softDelete / restore / permanentlyDelete', () => {
    it('excludes a soft-deleted employee from list() and includes it in listTrash()', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-trash-a',
          name: 'Trash Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await service.softDelete('emp-trash-a');

      const active = await service.list();
      expect(active.find((e) => e.userId === 'emp-trash-a')).toBeUndefined();

      const trashed = await service.listTrash();
      const found = trashed.find((e) => e.userId === 'emp-trash-a');
      expect(found).toBeDefined();
      expect(found?.deletedAt).not.toBeNull();
    });

    it('restores a soft-deleted employee back into list() and out of listTrash()', async () => {
      await service.restore('emp-trash-a');

      const active = await service.list();
      expect(active.find((e) => e.userId === 'emp-trash-a')).toBeDefined();

      const trashed = await service.listTrash();
      expect(trashed.find((e) => e.userId === 'emp-trash-a')).toBeUndefined();
    });

    it('permanently deletes an employee that is already in the trash', async () => {
      await service.softDelete('emp-trash-a');

      await service.permanentlyDelete('emp-trash-a');

      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-trash-a' },
      });
      expect(found).toBeNull();
    });

    it('throws BadRequestException when permanently deleting an active (non-trashed) employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-trash-b',
          name: 'Trash Beto',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await expect(service.permanentlyDelete('emp-trash-b')).rejects.toThrow(
        BadRequestException,
      );

      await prisma.employee.delete({ where: { userId: 'emp-trash-b' } });
    });

    it('throws BadRequestException when permanently deleting a userId that does not exist', async () => {
      await expect(
        service.permanentlyDelete('emp-does-not-exist'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePersonalData', () => {
    it('updates all personal fields, including role and hireDate', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-a',
          name: 'Antes Da Edicao',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      const updated = await service.updatePersonalData('emp-edit-a', {
        name: 'Depois Da Edicao',
        role: 'gestor',
        hireDate: '2025-06-01',
        cpf: '33333333333',
        rg: '7654321',
        dataNascimento: '1985-03-10',
        estadoCivil: 'divorciado',
        enderecoRua: 'Rua Nova',
        enderecoNumero: '200',
        enderecoBairro: 'Jardins',
        enderecoCidade: 'Rio de Janeiro',
        enderecoEstado: 'RJ',
        enderecoCep: '22000000',
      });

      expect(updated.name).toBe('Depois Da Edicao');
      expect(updated.role).toBe('gestor');
      expect(updated.hireDate.toISOString()).toBe('2025-06-01T00:00:00.000Z');
      expect(updated.cpf).toBe('33333333333');
      expect(updated.enderecoEstado).toBe('RJ');

      await prisma.employee.delete({ where: { userId: 'emp-edit-a' } });
    });

    it('updates convencaoId and salarioMensal', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-convencao',
          name: 'Antes Do Convenio',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      const updated = await service.updatePersonalData('emp-edit-convencao', {
        name: 'Depois Do Convenio',
        role: 'colaborador',
        cargo: null,
        team: null,
        nivel: null,
        hireDate: '2024-01-01',
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
        convencaoId: 'convencao-xyz',
        salarioMensal: 6200,
      });

      expect(updated.convencaoId).toBe('convencao-xyz');
      expect(updated.salarioMensal).toBe(6200);

      await prisma.employee.delete({ where: { userId: 'emp-edit-convencao' } });
    });

    it('does not conflict when the CPF submitted is unchanged from the same employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-b',
          name: 'Mesmo CPF',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cpf: '44444444444',
        },
      });

      const updated = await service.updatePersonalData('emp-edit-b', {
        name: 'Mesmo CPF Editado',
        role: 'colaborador',
        hireDate: '2024-01-01',
        cpf: '44444444444',
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      expect(updated.name).toBe('Mesmo CPF Editado');
      expect(updated.cpf).toBe('44444444444');

      await prisma.employee.delete({ where: { userId: 'emp-edit-b' } });
    });

    it('throws ConflictException when the new CPF belongs to a different employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-c1',
          name: 'Primeiro Editor',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cpf: '55555555555',
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-c2',
          name: 'Segundo Editor',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cpf: '66666666666',
        },
      });

      await expect(
        service.updatePersonalData('emp-edit-c2', {
          name: 'Segundo Editor',
          role: 'colaborador',
          hireDate: '2024-01-01',
          cpf: '55555555555',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow(ConflictException);

      await prisma.employee.deleteMany({
        where: { userId: { in: ['emp-edit-c1', 'emp-edit-c2'] } },
      });
    });

    it('throws ConflictException pointing to the lixeira when the new CPF belongs to a soft-deleted employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-trash-source',
          name: 'Foi Para Lixeira',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cpf: '99999999999',
          deletedAt: new Date(),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-d',
          name: 'Editor Tentando Reuso',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await expect(
        service.updatePersonalData('emp-edit-d', {
          name: 'Editor Tentando Reuso',
          role: 'colaborador',
          hireDate: '2024-01-01',
          cpf: '99999999999',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow(
        'Já existe um colaborador com esse CPF na lixeira — restaure-o ou exclua-o permanentemente antes de reutilizar o CPF.',
      );

      await prisma.employee.deleteMany({
        where: { userId: { in: ['emp-edit-trash-source', 'emp-edit-d'] } },
      });
    });
  });
});
