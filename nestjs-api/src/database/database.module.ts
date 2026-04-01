import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import {
  Video,
  Challenge,
  StaticFallbackQuestion,
  ChallengeDeliveryEvent,
  AiQuestionGenerationLog,
} from './entities';
import { applyStatsMigrationSql } from './apply-stats-migration';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: [
          Video,
          Challenge,
          StaticFallbackQuestion,
          ChallengeDeliveryEvent,
          AiQuestionGenerationLog,
        ],
        // Schema: init.sql em bases novas + 02-stats.sql no arranque (bases antigas)
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
      dataSourceFactory: async (options: DataSourceOptions) => {
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        await applyStatsMigrationSql(dataSource);
        return dataSource;
      },
    }),
    TypeOrmModule.forFeature([
      Video,
      Challenge,
      StaticFallbackQuestion,
      ChallengeDeliveryEvent,
      AiQuestionGenerationLog,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
