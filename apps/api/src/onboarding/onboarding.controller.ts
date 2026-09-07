import { BadRequestException, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ONBOARDING_ACCESS_ITEMS, type OnboardingAccessItem } from '@ponto-dcit/shared-types';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

function isOnboardingAccessItem(value: string): value is OnboardingAccessItem {
  return (ONBOARDING_ACCESS_ITEMS as readonly string[]).includes(value);
}

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @UseGuards(AuthGuard)
  @Get('tarefas')
  getTasks(@Req() req: AuthenticatedRequest) {
    return this.onboarding.getTasks(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('equipe')
  listTeamProgress() {
    return this.onboarding.listTeamProgress();
  }

  @UseGuards(AuthGuard)
  @Post('tarefas/:taskId/toggle')
  toggleTask(
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.onboarding.toggleTask(req.user.sub, taskId, req.user.name);
  }

  @UseGuards(AuthGuard)
  @Post('acessos/:item/toggle')
  toggleAccessItem(@Param('item') item: string, @Req() req: AuthenticatedRequest) {
    if (!isOnboardingAccessItem(item)) {
      throw new BadRequestException('item de acesso inválido');
    }
    return this.onboarding.toggleAccessItem(req.user.sub, item);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post('equipe/:userId/liberar-acesso')
  @HttpCode(200)
  grantFullAccess(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    return this.onboarding.grantFullAccess(userId, req.user.name);
  }

  @UseGuards(AuthGuard)
  @Get('meu-status')
  async myStatus(@Req() req: AuthenticatedRequest) {
    const unlocked = await this.onboarding.isUnlocked(req.user.sub);
    return { unlocked };
  }
}
