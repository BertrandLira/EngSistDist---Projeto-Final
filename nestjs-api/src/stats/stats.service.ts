import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../database/entities/video.entity';
import { ChallengeDeliveryEvent } from '../database/entities/challenge-delivery-event.entity';
import { AiQuestionGenerationLog } from '../database/entities/ai-question-generation-log.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
    @InjectRepository(ChallengeDeliveryEvent)
    private readonly deliveryRepo: Repository<ChallengeDeliveryEvent>,
    @InjectRepository(AiQuestionGenerationLog)
    private readonly aiLogRepo: Repository<AiQuestionGenerationLog>,
  ) {}

  async getVideosDashboard() {
    const videos = await this.videoRepo.find({
      order: { createdAt: 'DESC' },
    });

    const out = [];
    for (const v of videos) {
      const deliveries = await this.deliveryRepo.find({
        where: { videoId: v.id },
        order: { deliveredAt: 'DESC' },
      });
      const aiLogs = await this.aiLogRepo.find({
        where: { videoId: v.id },
        order: { createdAt: 'DESC' },
      });
      out.push({
        id: v.id,
        originalName: v.originalName,
        createdAt: v.createdAt,
        transcript: v.transcript,
        sceneDescription: v.sceneDescription,
        transcriptMode: v.transcriptMode,
        transcriptGeneratedAt: v.transcriptGeneratedAt,
        transcriptGenerationLog: v.transcriptGenerationLog,
        transcriptJobStatus: v.transcriptJobStatus,
        deliveryCount: deliveries.length,
        deliveries: deliveries.map((d) => ({
          id: d.id,
          deliveredAt: d.deliveredAt,
          deliverySource: d.deliverySource,
          challengeId: d.challengeId,
          staticQuestionId: d.staticQuestionId,
          questionSnapshot: d.questionSnapshot,
          optionsSnapshot: d.optionsSnapshot,
          answerSnapshot: d.answerSnapshot,
        })),
        aiGenerationLogs: aiLogs.map((l) => ({
          id: l.id,
          createdAt: l.createdAt,
          provider: l.provider,
          model: l.model,
          prompt: l.prompt,
          responseRaw: l.responseRaw,
        })),
      });
    }
    return { videos: out };
  }
}
