import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { PoolModule } from '../pool/pool.module';
import { Challenge } from '../database/entities/challenge.entity';
import { StaticFallbackQuestion } from '../database/entities/static-question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Challenge, StaticFallbackQuestion]),
    PoolModule,
  ],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
