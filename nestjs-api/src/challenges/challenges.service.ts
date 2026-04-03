import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoolService } from '../pool/pool.service';
import { Challenge } from '../database/entities/challenge.entity';
import { StaticFallbackQuestion } from '../database/entities/static-question.entity';
import { QuestionItemDto } from './dto/push-questions.dto';
import { DeliveryEventsService } from './delivery-events.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

export interface ChallengeResponse {
  id: string;
  question: string;
  options: string[];
  answer: string;
  source: 'pool' | 'vector' | 'static';
}

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    @InjectRepository(Challenge)
    private readonly challengeRepo: Repository<Challenge>,
    @InjectRepository(StaticFallbackQuestion)
    private readonly staticRepo: Repository<StaticFallbackQuestion>,
    private readonly pool: PoolService,
    private readonly deliveryEvents: DeliveryEventsService,
    private readonly rabbit: RabbitMQService,
  ) {}

  async getChallenge(videoId: string): Promise<ChallengeResponse> {
    let result: ChallengeResponse;
    const REFRESH_THRESHOLD = 2;

    // --- Camada 1: Redis Pool ---
    try {
      const pooled = await this.pool.popQuestion(videoId);

      if (pooled) {
        this.logger.log(`[CB] source=pool video=${videoId}`);

        void this.markChallengeConsumed(pooled.id);

        result = { ...pooled, source: 'pool' };
        void this.deliveryEvents.record(videoId, result);

        // Estratégia de Refresh: se o pool está ficando vazio, pede mais
        try {
          const poolSize = await this.pool.getPoolSize(videoId);
          if (poolSize < REFRESH_THRESHOLD) {
            this.logger.log(
              `Pool ficando baixo (${poolSize} < ${REFRESH_THRESHOLD}) para video=${videoId}. Solicitando mais.`,
            );
            await this.rabbit.publish({ videoId, amount: 5 });
          }
        } catch (err) {
          this.logger.warn(`Falha ao verificar pool para refresh: ${err}`);
        }

        return result;
      }
    } catch (err) {
      this.logger.warn(`[CB] Redis indisponível, pulando pool: ${err}`);
    }

    // --- Camada 2: DB / Vector Search ---
    const dbChallenge = await this.findUnusedChallenge(videoId);

    if (dbChallenge) {
      this.logger.log(`[CB] source=vector video=${videoId}`);

      void this.markChallengeConsumed(dbChallenge.id);

      result = {
        id: dbChallenge.id,
        question: dbChallenge.prompt,
        options: dbChallenge.options as string[],
        answer: dbChallenge.answer ?? '',
        source: 'vector',
      };

      void this.deliveryEvents.record(videoId, result);

      // Pool está vazio se chegamos aqui, solicita refresh
      try {
        await this.rabbit.publish({ videoId, amount: 5 });
        this.logger.log(
          `Pool vazio, solicitação enviada para video=${videoId} (source=vector)`,
        );
      } catch (err) {
        this.logger.warn(`Erro ao publicar no RabbitMQ: ${err}`);
      }

      return result;
    }

    // --- Camada 3: Static Fallback ---
    this.logger.warn(
      `[CB] OPEN — pool e DB vazios, usando fallback estático para video=${videoId}`,
    );

    result = await this.getStaticFallback();
    void this.deliveryEvents.record(videoId, result);

    // Pool e DB vazios, solicita refresh urgente
    try {
      await this.rabbit.publish({ videoId, amount: 5 });
      this.logger.log(
        `Pool/DB vazios, solicitação enviada para video=${videoId} (source=static)`,
      );
    } catch (err) {
      this.logger.warn(`Erro ao publicar no RabbitMQ: ${err}`);
    }

    return result;
  }

  async pushQuestionsToPool(
    videoId: string,
    questions: QuestionItemDto[],
  ): Promise<{ pushed: number }> {
    const saved: Challenge[] = [];

    for (const q of questions) {
      const challenge = this.challengeRepo.create({
        videoId,
        prompt: q.question,
        options: q.options,
        answer: q.answer,
        source: 'ai',
        consumed: false,
      });

      const entity = await this.challengeRepo.save(challenge);

      if (q.embedding?.length) {
        const vectorLiteral = `[${q.embedding.join(',')}]`;
        await this.challengeRepo.query(
          `UPDATE challenges SET embedding = $1::vector WHERE id = $2`,
          [vectorLiteral, entity.id],
        );
      }

      saved.push(entity);
    }

    let pushed = 0;

    try {
      pushed = await this.pool.pushQuestions(
        videoId,
        saved.map((s) => ({
          id: s.id,
          question: s.prompt,
          options: s.options as string[],
          answer: s.answer ?? '',
        })),
      );
    } catch (err) {
      this.logger.warn(`Redis indisponível ao empurrar pool: ${err}`);
    }

    return { pushed };
  }

  async getPoolSize(
    videoId: string,
  ): Promise<{ videoId: string; size: number }> {
    try {
      const size = await this.pool.getPoolSize(videoId);
      return { videoId, size };
    } catch {
      return { videoId, size: 0 };
    }
  }

  async countUnusedDbChallenges(videoId: string): Promise<number> {
    return this.challengeRepo.count({
      where: { videoId, consumed: false, source: 'ai' },
    });
  }

  private async findUnusedChallenge(videoId: string): Promise<Challenge | null> {
    // Camada 2a: Busca exata por vídeo
    const exact = await this.challengeRepo.findOne({
      where: { videoId, consumed: false, source: 'ai' },
      order: { createdAt: 'DESC' },
    });
    if (exact) return exact;

    // Camada 2b: Busca vetorial cross-vídeo (pgvector similarity search)
    // Usa o embedding de qualquer challenge do vídeo como referência
    try {
      const results: Challenge[] = await this.challengeRepo.query(
        `SELECT c.id, c.video_id as "videoId", c.prompt, c.options, c.answer,
                c.source, c.consumed, c.created_at as "createdAt"
         FROM challenges c
         WHERE c.consumed = false
           AND c.source = 'ai'
           AND c.video_id != $1
           AND c.embedding IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM challenges ref
             WHERE ref.video_id = $1 AND ref.embedding IS NOT NULL
           )
         ORDER BY c.embedding <=> (
           SELECT ref.embedding FROM challenges ref
           WHERE ref.video_id = $1 AND ref.embedding IS NOT NULL
           ORDER BY ref.created_at DESC
           LIMIT 1
         )
         LIMIT 1`,
        [videoId],
      );
      if (results.length > 0) {
        this.logger.log(`[CB] source=vector-cross video=${videoId} (similaridade pgvector)`);
        return results[0];
      }
    } catch (err) {
      this.logger.warn(`Busca vetorial cross-vídeo falhou, ignorando: ${err}`);
    }

    return null;
  }

  private async markChallengeConsumed(challengeId: string): Promise<void> {
    await this.challengeRepo
      .update(challengeId, { consumed: true })
      .catch(() => undefined);
  }

  private async getStaticFallback(): Promise<ChallengeResponse> {
    const count = await this.staticRepo.count();

    if (count === 0) {
      return {
        id: 'hardcoded-fallback',
        question: 'O que você considerou mais relevante neste vídeo?',
        options: [
          'A abordagem do tema',
          'Os exemplos utilizados',
          'A clareza da explicação',
          'A aplicação prática',
        ],
        answer: 'A clareza da explicação',
        source: 'static',
      };
    }

    const skip = Math.floor(Math.random() * count);
    const results = await this.staticRepo.find({ skip, take: 1 });
    const q = results[0];

    return {
      id: q.id,
      question: q.prompt,
      options: q.options as string[],
      answer: q.answer ?? '',
      source: 'static',
    };
  }
}