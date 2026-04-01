import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { PoolModule } from '../pool/pool.module';
import { Challenge } from '../database/entities/challenge.entity';
import { StaticFallbackQuestion } from '../database/entities/static-question.entity';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { ChallengeDeliveryEvent } from '../database/entities/challenge-delivery-event.entity';
import { DeliveryEventsService } from './delivery-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Challenge,
      StaticFallbackQuestion,
      ChallengeDeliveryEvent,
    ]),
    PoolModule,
    RabbitMQModule,
  ],
  controllers: [ChallengesController],
  providers: [ChallengesService, DeliveryEventsService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
