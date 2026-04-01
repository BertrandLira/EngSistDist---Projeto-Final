import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from '../database/entities/video.entity';
import { ChallengeDeliveryEvent } from '../database/entities/challenge-delivery-event.entity';
import { AiQuestionGenerationLog } from '../database/entities/ai-question-generation-log.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Video,
      ChallengeDeliveryEvent,
      AiQuestionGenerationLog,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
