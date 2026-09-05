import { Module } from '@nestjs/common';
import { CareerEvaluationsController } from './evaluations.controller';
import { CareerEvaluationsService } from './evaluations.service';
import { PromotabilidadeController } from './promotabilidade.controller';
import { PromotabilidadeService } from './promotabilidade.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MuralModule } from '../mural/mural.module';

@Module({
  imports: [AuthModule, NotificationsModule, MuralModule],
  controllers: [CareerEvaluationsController, PromotabilidadeController],
  providers: [CareerEvaluationsService, PromotabilidadeService],
})
export class CarreiraModule {}
