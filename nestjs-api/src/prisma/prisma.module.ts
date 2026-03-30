import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Módulo global: PrismaService fica disponível em toda a aplicação sem reimportar. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
