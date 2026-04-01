import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoolService } from '../pool/pool.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { Challenge } from '../database/entities/challenge.entity';
import { StaticFallbackQuestion } from '../database/entities/static-question.entity';
import { QuestionItemDto } from './dto/push-questions.dto';

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

    private readonly rabbit: RabbitMQService,
  ) {}

  /**
   * Retorna o próximo desafio para um vídeo usando Circuit Breaker:
   * 1º Redis Pool
   * 2º DB / Vector
   * 3º Static fallback
   */
  async getChallenge(videoId: string): Promise<ChallengeResponse> {
    // --- Camada 1: Redis Pool ---
    try {
      const pooled = await this.pool.popQuestion(videoId);

      if (pooled) {
        this.logger.log(`[CB] source=pool video=${videoId}`);

        // verifica tamanho do pool
        try {
          const poolSize = await this.pool.getPoolSize(videoId);

          if (poolSize < 3) {
            this.logger.log(
              `Pool baixo (${poolSize}) → solicitando geração de desafios`,
            );

            await this.rabbit.publish({
              videoId,
              amount: 5,
            });
          }
        } catch (err) {
          this.logger.warn(`Erro ao verificar tamanho do pool: ${err}`);
        }

        void this.markChallengeConsumed(pooled.id);

        return { ...pooled, source: 'pool' };
      }
    } catch (err) {
      this.logger.warn(`[CB] Redis indisponível, pulando pool: ${err}`);
    }

    // Pool vazio → pedir geração
    try {
      this.logger.warn(`Pool vazio → solicitando geração de desafios`);

      await this.rabbit.publish({
        videoId,
        amount: 5,
      });
    } catch (err) {
      this.logger.warn(`Erro ao publicar no RabbitMQ: ${err}`);
    }

    // --- Camada 2: DB / Vector Search ---
    const dbChallenge = await this.findUnusedChallenge(videoId);

    if (dbChallenge) {
      this.logger.log(`[CB] source=vector video=${videoId}`);

      void this.markChallengeConsumed(dbChallenge.id);

      return {
        id: dbChallenge.id,
        question: dbChallenge.prompt,
        options: dbChallenge.options as string[],
        answer: dbChallenge.answer ?? '',
        source: 'vector',
      };
    }

    // --- Camada 3: Static Fallback ---
    this.logger.warn(
      `[CB] OPEN — pool e DB vazios, usando fallback estático para video=${videoId}`,
    );

    return this.getStaticFallback();
  }

  /**
   * Recebe perguntas geradas pelo worker, salva no banco e empurra para o Redis
   */
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
    return this.challengeRepo.findOne({
      where: { videoId, consumed: false, source: 'ai' },
      order: { createdAt: 'DESC' },
    });
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

    const results = await this.staticRepo.find({
      skip,
      take: 1,
    });

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