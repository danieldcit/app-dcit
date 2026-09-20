import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AvatarUploadInputSchema,
  EmployeeCreateSchema,
  EmployeeScheduleUpdateSchema,
  MyPersonalDataUpdateSchema,
  TipoContratacaoUpdateSchema,
} from '@ponto-dcit/shared-types';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get()
  list() {
    return this.employees.list();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = EmployeeCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.create(result.data);
  }

  // Registered before ':userId/personal-data' below — Nest matches routes
  // in declaration order, and ':userId' would otherwise swallow the literal
  // "me" segment first, sending this self-service call into the gestor/rh
  // handler (and its RolesGuard) instead.
  @UseGuards(AuthGuard)
  @Get('me/personal-data')
  async getMyPersonalData(@Req() req: AuthenticatedRequest) {
    return this.employees.getMyPersonalData(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Patch('me/personal-data')
  async updateMyPersonalData(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = MyPersonalDataUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.updateMyPersonalData(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch(':userId/personal-data')
  async updatePersonalData(
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    const result = EmployeeCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.updatePersonalData(userId, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('trash')
  listTrash() {
    return this.employees.listTrash();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Delete(':userId')
  @HttpCode(204)
  async softDelete(@Param('userId') userId: string) {
    await this.employees.softDelete(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch(':userId/restore')
  restore(@Param('userId') userId: string) {
    return this.employees.restore(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Delete(':userId/permanent')
  @HttpCode(204)
  async permanentlyDelete(@Param('userId') userId: string) {
    await this.employees.permanentlyDelete(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch(':userId')
  async updateSchedule(@Param('userId') userId: string, @Body() body: unknown) {
    const result = EmployeeScheduleUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.updateSchedule(userId, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Patch(':userId/tipo-contratacao')
  async updateTipoContratacao(@Param('userId') userId: string, @Body() body: unknown) {
    const result = TipoContratacaoUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.updateTipoContratacao(userId, result.data.tipoContratacao);
  }

  @UseGuards(AuthGuard)
  @Get('me/avatar')
  async getMyAvatar(@Req() req: AuthenticatedRequest) {
    const photo = await this.employees.getMyAvatar(req.user.sub);
    return { photo };
  }

  @UseGuards(AuthGuard)
  @Post('me/avatar')
  async setMyAvatar(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = AvatarUploadInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    const photo = await this.employees.setMyAvatar(req.user.sub, result.data.photo);
    return { photo };
  }

  @UseGuards(AuthGuard)
  @Delete('me/avatar')
  @HttpCode(204)
  async removeMyAvatar(@Req() req: AuthenticatedRequest) {
    await this.employees.removeMyAvatar(req.user.sub);
  }
}
