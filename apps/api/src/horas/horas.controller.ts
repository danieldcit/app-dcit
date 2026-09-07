import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PeriodoHorasSchema, TicketsEntryCreateSchema } from '@ponto-dcit/shared-types';
import { HorasService } from './horas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('horas')
export class HorasController {
  constructor(private readonly horas: HorasService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get('resumo')
  async resumo(@Query('periodo') periodo?: string) {
    const parsed = PeriodoHorasSchema.safeParse(periodo);
    if (!parsed.success) throw new BadRequestException('periodo deve ser dia, semana ou mes');
    return this.horas.resumo(parsed.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async list(@Query('userId') userId?: string, @Query('periodo') periodo?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    const parsed = PeriodoHorasSchema.safeParse(periodo);
    if (!parsed.success) throw new BadRequestException('periodo deve ser dia, semana ou mes');
    return this.horas.list(userId, parsed.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async lancar(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = TicketsEntryCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.horas.lancar(result.data, req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    return this.horas.remove(id);
  }
}
