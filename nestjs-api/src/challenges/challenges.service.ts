import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoolService } from '../pool/pool.service';
import { Challenge } from '../database/entities/challenge.entity';
import { StaticFallbackQuestion } from '../database/entities/static-question.entity';
import { QuestionItemDto } from './dto/push-questions.dto';
import { DeliveryEventsService } from './delivery-events.service';

export interface ChallengeResponse {
  id: string;
  question: string;
  options: string[];
  answer: string;
  /** Indica qual camada do circuit-breaker serviu a pergunta. */
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
  ) {}

  /**
   * Retorna o próximo desafio para um vídeo usando o padrão Circuit Breaker:
   *   1º Redis pool   → pergunta gerada pela IA pré-carregada
   *   2º DB (vector)  → pergunta não utilizada no banco relacional
   *   3º Fallback     → pergunta genérica da tabela static_fallback_questions
   */
  async getChallenge(videoId: string): Promise<ChallengeResponse> {
    let result: ChallengeResponse;

    // --- Camada 1: Redis Pool ---
    try {
      const pooled = await this.pool.popQuestion(videoId);
      if (pooled) {
        this.logger.log(`[CB] source=pool  video=${videoId}`);
        void this.markChallengeConsumed(pooled.id);
        result = { ...pooled, source: 'pool' };
        void this.deliveryEvents.record(videoId, result);
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
      return result;
    }

    // --- Camada 3: Static Fallback (Circuit Breaker OPEN) ---
    this.logger.warn(
      `[CB] OPEN — pool e DB vazios, usando fallback estático para video=${videoId}`,
    );
    result = await this.getStaticFallback();
    void this.deliveryEvents.record(videoId, result);
    return result;
  }

  /**
   * Recebe perguntas geradas pelo worker, persiste no banco e empurra no pool Redis.
   */
  async pushQuestionsToPool(
    videoId: string,
    questions: QuestionItemDto[],
  ): Promise<{ pushed: number }> {
    // Persiste no banco
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

      // Salva embedding via raw SQL (TypeORM não suporta tipo vector nativamente)
      if (q.embedding?.length) {
        const vectorLiteral = `[${q.embedding.join(',')}]`;
        await this.challengeRepo.query(
          `UPDATE challenges SET embedding = $1::vector WHERE id = $2`,
          [vectorLiteral, entity.id],
        );
      }

      saved.push(entity);
    }

    // Empurra para o pool Redis
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
