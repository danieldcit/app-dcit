import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { PAGAMENTO_CATEGORIAS, SendPagamentoSchema } from '@ponto-dcit/shared-types';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

const PagamentoStatusQuerySchema = z.object({
  start: z.string().date(),
  end: z.string().date(),
});

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Post('pagamentos')
  async sendPagamento(@Body() body: unknown) {
    const result = SendPagamentoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    await this.notifications.sendPagamento(result.data.category, result.data.userIds);
    return { sent: result.data.userIds.length };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Get('pagamentos/status/:category')
  pagamentoStatus(
    @Param('category') category: string,
    @Query() query: unknown,
  ) {
    if (!(PAGAMENTO_CATEGORIAS as readonly string[]).includes(category)) {
      throw new BadRequestException('categoria inválida');
    }
    const result = PagamentoStatusQuerySchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    if (result.data.start > result.data.end) {
      throw new BadRequestException('O parâmetro start não pode ser posterior a end.');
    }
    return this.notifications.pagamentoStatus(
      category as (typeof PAGAMENTO_CATEGORIAS)[number],
      result.data.start,
      result.data.end,
    );
  }

  @UseGuards(AuthGuard)
  @Get('mine')
  listMine(@Req() req: AuthenticatedRequest) {
    return this.notifications.listMine(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notifications.markRead(id, req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notifications.markAllRead(req.user.sub);
  }
}
