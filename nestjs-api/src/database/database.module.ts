import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Video, Challenge, StaticFallbackQuestion } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: [Video, Challenge, StaticFallbackQuestion],
        // Schema is managed by init.sql — TypeORM only reads
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([Video, Challenge, StaticFallbackQuestion]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
