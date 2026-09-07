import { Module } from '@nestjs/common';
import { BancoDeHorasController } from './banco-de-horas.controller';
import { BancoDeHorasService } from './banco-de-horas.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BancoDeHorasController],
  providers: [BancoDeHorasService],
  exports: [BancoDeHorasService],
})
export class BancoDeHorasModule {}
