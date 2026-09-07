import { Module } from '@nestjs/common';
import { HorasController } from './horas.controller';
import { HorasService } from './horas.service';
import { AuthModule } from '../auth/auth.module';
import { BancoDeHorasModule } from '../banco-de-horas/banco-de-horas.module';

@Module({
  imports: [AuthModule, BancoDeHorasModule],
  controllers: [HorasController],
  providers: [HorasService],
})
export class HorasModule {}
