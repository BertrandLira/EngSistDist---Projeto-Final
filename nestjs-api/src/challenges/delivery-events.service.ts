import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChallengeDeliveryEvent } from '../database/entities/challenge-delivery-event.entity';
import type { ChallengeResponse } from './challenges.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DeliveryEventsService {
  private readonly logger = new Logger(DeliveryEventsService.name);

  constructor(
    @InjectRepository(ChallengeDeliveryEvent)
    private readonly repo: Repository<ChallengeDeliveryEvent>,
  ) {}

  async record(videoId: string, res: ChallengeResponse): Promise<void> {
    try {
      let challengeId: string | null = null;
      let staticQuestionId: string | null = null;
      if (res.source === 'static') {
        if (UUID_RE.test(res.id)) staticQuestionId = res.id;
      } else {
        if (UUID_RE.test(res.id)) challengeId = res.id;
      }
      await this.repo.insert({
        videoId,
        deliverySource: res.source,
        challengeId,
        staticQuestionId,
        questionSnapshot: res.question,
        optionsSnapshot: res.options,
        answerSnapshot: res.answer ?? null,
      });
    } catch (err) {
      this.logger.warn(`Falha ao registrar entrega de desafio: ${err}`);
    }
  }
}
