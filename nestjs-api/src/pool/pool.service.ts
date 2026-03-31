import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface PoolQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
}

/**
 * Gerencia o pool assíncrono de perguntas geradas pela IA no Redis.
 *
 * Cada vídeo tem sua própria fila: `pool:video:{videoId}`
 *   - Worker empurra via pushQuestions() (RPUSH)
 *   - API consome via popQuestion()   (LPOP)
 */
@Injectable()
export class PoolService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(PoolService.name);
  private static readonly KEY_PREFIX = 'pool:video:';

  constructor(private readonly config: ConfigService) {
    const url =
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redis = new Redis(url, { lazyConnect: true });
    this.redis.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  /**
   * Empurra perguntas ao final da fila do vídeo.
   * @returns tamanho do pool após a inserção
   */
  async pushQuestions(
    videoId: string,
    questions: PoolQuestion[],
  ): Promise<number> {
    if (!questions.length) return 0;
    const key = `${PoolService.KEY_PREFIX}${videoId}`;
    const serialized = questions.map((q) => JSON.stringify(q));
    const poolSize = await this.redis.rpush(key, ...serialized);
    this.logger.log(
      `Pushed ${questions.length} question(s) → pool:video:${videoId} (size=${poolSize})`,
    );
    return poolSize;
  }

  /**
   * Retira a primeira pergunta disponível da fila (FIFO).
   * Retorna null quando o pool está vazio (Circuit Breaker abre).
   */
  async popQuestion(videoId: string): Promise<PoolQuestion | null> {
    const key = `${PoolService.KEY_PREFIX}${videoId}`;
    const raw = await this.redis.lpop(key);
    if (!raw) return null;
    return JSON.parse(raw) as PoolQuestion;
  }

  /** Quantidade atual de perguntas no pool do vídeo. */
  async getPoolSize(videoId: string): Promise<number> {
    const key = `${PoolService.KEY_PREFIX}${videoId}`;
    return this.redis.llen(key);
  }

  /** Remove todas as perguntas do pool de um vídeo. */
  async clearPool(videoId: string): Promise<void> {
    const key = `${PoolService.KEY_PREFIX}${videoId}`;
    await this.redis.del(key);
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }
}
