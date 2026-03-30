import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PoolService } from '../pool/pool.service';

export interface Challenge {
  id: string;
  question: string;
  options: string[];
  answer: string;
  /** Indica qual camada do circuit-breaker serviu a pergunta. */
  source: 'pool' | 'vector' | 'static';
}

export interface QuestionInput {
  question: string;
  options: string[];
  answer: string;
  embedding?: number[];
}

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pool: PoolService,
  ) {}

  /**
   * Retorna o próximo desafio para um vídeo usando o padrão Circuit Breaker:
   *   1º Redis pool   → pergunta gerada pela IA pré-carregada
   *   2º DB (vector)  → pergunta não utilizada no banco relacional
   *   3º Fallback     → pergunta genérica da tabela StaticQuestion
   */
  async getChallenge(videoId: string): Promise<Challenge> {
    // --- Camada 1: Redis Pool ---
    const pooled = await this.pool.popQuestion(videoId);
    if (pooled) {
      this.logger.log(`[CB] source=pool  video=${videoId}`);
      void this.markQuestionUsed(pooled.id);
      return { ...pooled, source: 'pool' };
    }

    // --- Camada 2: DB / Vector Search ---
    const dbQuestion = await this.findUnusedDbQuestion(videoId);
    if (dbQuestion) {
      this.logger.log(`[CB] source=vector video=${videoId}`);
      void this.markQuestionUsed(dbQuestion.id);
      return {
        id: dbQuestion.id,
        question: dbQuestion.question,
        options: dbQuestion.options as string[],
        answer: dbQuestion.answer,
        source: 'vector',
      };
    }

    // --- Camada 3: Static Fallback (Circuit Breaker OPEN) ---
    this.logger.warn(
      `[CB] OPEN — pool e DB vazios, usando fallback estático para video=${videoId}`,
    );
    return this.getStaticFallback();
  }

  /**
   * Recebe perguntas geradas pelo worker, persiste no banco e empurra no pool Redis.
   * Endpoint chamado pelo python-worker após gerar as perguntas via IA.
   */
  async pushQuestionsToPool(
    videoId: string,
    questions: QuestionInput[],
  ): Promise<{ pushed: number }> {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) throw new NotFoundException(`Video ${videoId} not found`);

    // Persiste no banco primeiro para ter IDs
    const saved = await Promise.all(
      questions.map((q) =>
        this.prisma.generatedQuestion.create({
          data: {
            videoId,
            question: q.question,
            options: q.options,
            answer: q.answer,
          },
        }),
      ),
    );

    // Atualiza embeddings via raw SQL (campo Unsupported no Prisma)
    for (let i = 0; i < questions.length; i++) {
      const embedding = questions[i].embedding;
      if (embedding?.length === 1536) {
        const vectorLiteral = `[${embedding.join(',')}]`;
        await this.prisma.$executeRaw`
          UPDATE "GeneratedQuestion"
          SET embedding = ${vectorLiteral}::vector
          WHERE id = ${saved[i].id}
        `;
      }
    }

    // Empurra para o pool Redis
    const pushed = await this.pool.pushQuestions(
      videoId,
      saved.map((s) => ({
        id: s.id,
        question: s.question,
        options: s.options as string[],
        answer: s.answer,
      })),
    );

    return { pushed };
  }

  async getPoolSize(
    videoId: string,
  ): Promise<{ videoId: string; size: number }> {
    const size = await this.pool.getPoolSize(videoId);
    return { videoId, size };
  }

  private async findUnusedDbQuestion(videoId: string) {
    return this.prisma.generatedQuestion.findFirst({
      where: { videoId, usedAt: null, inPool: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async markQuestionUsed(questionId: string): Promise<void> {
    await this.prisma.generatedQuestion
      .update({
        where: { id: questionId },
        data: { usedAt: new Date(), inPool: false },
      })
      .catch(() => undefined);
  }

  private async getStaticFallback(): Promise<Challenge> {
    const count = await this.prisma.staticQuestion.count();
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
    const q = await this.prisma.staticQuestion.findFirst({ skip });
    return {
      id: q!.id,
      question: q!.question,
      options: q!.options as string[],
      answer: q!.answer,
      source: 'static',
    };
  }
}
