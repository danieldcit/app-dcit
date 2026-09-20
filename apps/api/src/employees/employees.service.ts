import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  EmployeeCreateInput,
  EmployeeScheduleUpdate,
  MyPersonalDataUpdateInput,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 10;

// Same value as every other dev/demo account (see prisma/seed.ts) — this is
// local/demo data, not a real credential. No invite/set-your-own-password
// flow exists yet, so every employee an RH/gestor gives an email to shares
// this one password until that flow is built.
const DEV_PASSWORD = 'dev12345';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async updatePersonalData(userId: string, input: EmployeeCreateInput) {
    const existing = await this.prisma.employee.findUnique({
      where: { userId },
      select: { passwordHash: true },
    });
    try {
      return await this.prisma.employee.update({
        where: { userId },
        data: {
          name: input.name,
          role: input.role,
          email: input.email,
          passwordHash: this.resolvePasswordHash(input.email, existing?.passwordHash),
          cargo: input.cargo,
          team: input.team,
          nivel: input.nivel,
          convencaoId: input.convencaoId,
          salarioMensal: input.salarioMensal,
          hireDate: new Date(input.hireDate),
          cpf: input.cpf,
          rg: input.rg,
          dataNascimento: input.dataNascimento
            ? new Date(input.dataNascimento)
            : null,
          estadoCivil: input.estadoCivil,
          enderecoRua: input.enderecoRua,
          enderecoNumero: input.enderecoNumero,
          enderecoBairro: input.enderecoBairro,
          enderecoCidade: input.enderecoCidade,
          enderecoEstado: input.enderecoEstado,
          enderecoCep: input.enderecoCep,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(await this.uniqueConstraintMessage(error, input));
      }
      throw error;
    }
  }

  // Login por senha (novo): quando um email é definido e o colaborador ainda
  // não tem senha própria (nunca fez "esqueci minha senha"), ganha a senha
  // padrão de desenvolvimento — nunca sobrescreve uma senha já existente.
  // Limpar o email (null) desativa o login por senha, limpando o hash junto.
  private resolvePasswordHash(
    email: string | null | undefined,
    existingHash: string | null | undefined,
  ): string | null | undefined {
    if (!email) return null;
    if (existingHash) return undefined;
    return bcrypt.hashSync(DEV_PASSWORD, BCRYPT_ROUNDS);
  }

  /**
   * cpf and email are both globally @unique, and soft-deleting an employee
   * does not clear either — so a P2002 may point at an employee sitting in
   * the lixeira rather than an active one. error.meta.target tells us which
   * column actually conflicted (Prisma/SQLite reports it as an array of
   * column names).
   */
  private async uniqueConstraintMessage(
    error: Prisma.PrismaClientKnownRequestError,
    input: { cpf: string | null; email: string | null },
  ): Promise<string> {
    const target = error.meta?.target;
    const columns = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];

    if (columns.includes('email') && input.email) {
      const conflicting = await this.prisma.employee.findUnique({ where: { email: input.email } });
      if (conflicting?.deletedAt) {
        return 'Já existe um colaborador com esse email na lixeira — restaure-o ou exclua-o permanentemente antes de reutilizar o email.';
      }
      return 'Já existe um colaborador cadastrado com esse email.';
    }

    if (input.cpf) {
      const conflicting = await this.prisma.employee.findUnique({ where: { cpf: input.cpf } });
      if (conflicting?.deletedAt) {
        return 'Já existe um colaborador com esse CPF na lixeira — restaure-o ou exclua-o permanentemente antes de reutilizar o CPF.';
      }
    }
    return 'Já existe um colaborador cadastrado com esse CPF.';
  }

  listTrash() {
    return this.prisma.employee.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  softDelete(userId: string) {
    return this.prisma.employee.update({
      where: { userId },
      data: { deletedAt: new Date() },
    });
  }

  restore(userId: string) {
    return this.prisma.employee.update({
      where: { userId },
      data: { deletedAt: null },
    });
  }

  async permanentlyDelete(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee || employee.deletedAt === null) {
      throw new BadRequestException(
        'Só é possível excluir permanentemente um colaborador que já está na lixeira.',
      );
    }
    await this.prisma.employee.delete({ where: { userId } });
  }

  updateSchedule(userId: string, input: EmployeeScheduleUpdate) {
    return this.prisma.employee.update({
      where: { userId },
      data: { expectedStartTime: input.expectedStartTime },
    });
  }

  async getMyAvatar(userId: string): Promise<string | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { avatarDataUrl: true },
    });
    return employee?.avatarDataUrl ?? null;
  }

  async setMyAvatar(userId: string, photo: string): Promise<string> {
    const updated = await this.prisma.employee.update({
      where: { userId },
      data: { avatarDataUrl: photo },
      select: { avatarDataUrl: true },
    });
    return updated.avatarDataUrl as string;
  }

  async removeMyAvatar(userId: string): Promise<void> {
    await this.prisma.employee.update({
      where: { userId },
      data: { avatarDataUrl: null },
    });
  }

  private static readonly MY_PERSONAL_DATA_SELECT = {
    rg: true,
    dataNascimento: true,
    estadoCivil: true,
    enderecoRua: true,
    enderecoNumero: true,
    enderecoBairro: true,
    enderecoCidade: true,
    enderecoEstado: true,
    enderecoCep: true,
    phone: true,
  } satisfies Prisma.EmployeeSelect;

  getMyPersonalData(userId: string) {
    return this.prisma.employee.findUniqueOrThrow({
      where: { userId },
      select: EmployeesService.MY_PERSONAL_DATA_SELECT,
    });
  }

  updateMyPersonalData(userId: string, input: MyPersonalDataUpdateInput) {
    return this.prisma.employee.update({
      where: { userId },
      data: {
        rg: input.rg,
        dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null,
        estadoCivil: input.estadoCivil,
        enderecoRua: input.enderecoRua,
        enderecoNumero: input.enderecoNumero,
        enderecoBairro: input.enderecoBairro,
        enderecoCidade: input.enderecoCidade,
        enderecoEstado: input.enderecoEstado,
        enderecoCep: input.enderecoCep,
        phone: input.phone,
      },
      select: EmployeesService.MY_PERSONAL_DATA_SELECT,
    });
  }

  updateTipoContratacao(userId: string, tipoContratacao: 'CLT' | 'PJ' | 'terceirizado' | null) {
    return this.prisma.employee.update({
      where: { userId },
      data: { tipoContratacao },
    });
  }

  async create(input: EmployeeCreateInput) {
    try {
      return await this.prisma.employee.create({
        data: {
          userId: randomUUID(),
          name: input.name,
          role: input.role,
          email: input.email,
          passwordHash: this.resolvePasswordHash(input.email, undefined),
          cargo: input.cargo,
          team: input.team,
          nivel: input.nivel,
          convencaoId: input.convencaoId,
          salarioMensal: input.salarioMensal,
          hireDate: new Date(input.hireDate),
          cpf: input.cpf,
          rg: input.rg,
          dataNascimento: input.dataNascimento
            ? new Date(input.dataNascimento)
            : null,
          estadoCivil: input.estadoCivil,
          enderecoRua: input.enderecoRua,
          enderecoNumero: input.enderecoNumero,
          enderecoBairro: input.enderecoBairro,
          enderecoCidade: input.enderecoCidade,
          enderecoEstado: input.enderecoEstado,
          enderecoCep: input.enderecoCep,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(await this.uniqueConstraintMessage(error, input));
      }
      throw error;
    }
  }
}
