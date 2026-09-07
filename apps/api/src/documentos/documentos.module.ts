import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [AuthModule, PushModule, NotificationsModule, OnboardingModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
