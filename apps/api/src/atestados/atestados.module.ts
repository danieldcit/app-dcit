import { Module } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AtestadosController } from './atestados.controller';
import { AtestadosService } from './atestados.service';
import { ANTHROPIC_CLIENT } from './anthropic-client.token';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AtestadosController],
  providers: [
    AtestadosService,
    {
      // Reads ANTHROPIC_API_KEY from the environment (loaded by main.ts
      // before Nest boots) — no network call at construction time, so a
      // missing/invalid key only surfaces when an atestado is actually
      // uploaded, not at app startup.
      provide: ANTHROPIC_CLIENT,
      useFactory: () => new Anthropic(),
    },
  ],
})
export class AtestadosModule {}
