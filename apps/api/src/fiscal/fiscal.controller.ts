import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FiscalParametersInputSchema } from '@ponto-dcit/shared-types';
import { FiscalService } from './fiscal.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get('dashboard')
  getDashboard(@Query('team') team?: string, @Query('tipoContratacao') tipoContratacao?: string) {
    return this.fiscal.getDashboard({ team, tipoContratacao });
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get('parametros')
  getParametros() {
    return this.fiscal.getParametros();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post('parametros')
  async updateParametros(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = FiscalParametersInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.fiscal.updateParametros(result.data, req.user.sub);
  }
}
