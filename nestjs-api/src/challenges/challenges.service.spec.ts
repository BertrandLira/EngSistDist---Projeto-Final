import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { PrismaService } from '../prisma/prisma.service';
import { PoolService } from '../pool/pool.service';

const mockPrisma = {
  video: { findUnique: jest.fn() },
  generatedQuestion: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  staticQuestion: {
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  $executeRaw: jest.fn(),
};

const mockPool = {
  popQuestion: jest.fn(),
  pushQuestions: jest.fn(),
  getPoolSize: jest.fn(),
};

const DB_QUESTION = { id: 'db-q1', question: 'Pergunta DB?', options: ['A','B','C','D'], answer: 'A' };
const STATIC_QUESTION = { id: 'static-1', question: 'Pergunta estática?', options: ['X','Y','Z','W'], answer: 'X' };

describe('ChallengesService', () => {
  let service: ChallengesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PoolService, useValue: mockPool },
      ],
    }).compile();
    service = module.get<ChallengesService>(ChallengesService);
  });

  describe('getChallenge', () => {
    it('Camada 1 — deve retornar do pool Redis quando disponível', async () => {
      mockPool.popQuestion.mockResolvedValue(DB_QUESTION);
      mockPrisma.generatedQuestion.update.mockResolvedValue({});

      const result = await service.getChallenge('vid-1');

      expect(result.source).toBe('pool');
      expect(result.id).toBe('db-q1');
      expect(mockPrisma.generatedQuestion.findFirst).not.toHaveBeenCalled();
    });

    it('Camada 2 — deve buscar do banco quando pool vazio', async () => {
      mockPool.popQuestion.mockResolvedValue(null);
      mockPrisma.generatedQuestion.findFirst.mockResolvedValue(DB_QUESTION);
      mockPrisma.generatedQuestion.update.mockResolvedValue({});

      const result = await service.getChallenge('vid-1');

      expect(result.source).toBe('vector');
      expect(result.id).toBe('db-q1');
      expect(mockPrisma.generatedQuestion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { videoId: 'vid-1', usedAt: null, inPool: true } }),
      );
    });

    it('Camada 3 — deve usar fallback estático quando pool e DB vazios', async () => {
      mockPool.popQuestion.mockResolvedValue(null);
      mockPrisma.generatedQuestion.findFirst.mockResolvedValue(null);
      mockPrisma.staticQuestion.count.mockResolvedValue(5);
      mockPrisma.staticQuestion.findFirst.mockResolvedValue(STATIC_QUESTION);

      const result = await service.getChallenge('vid-1');

      expect(result.source).toBe('static');
      expect(result.id).toBe('static-1');
    });

    it('Camada 3 — deve retornar hardcoded quando tabela estática também está vazia', async () => {
      mockPool.popQuestion.mockResolvedValue(null);
      mockPrisma.generatedQuestion.findFirst.mockResolvedValue(null);
      mockPrisma.staticQuestion.count.mockResolvedValue(0);

      const result = await service.getChallenge('vid-1');

      expect(result.source).toBe('static');
      expect(result.id).toBe('hardcoded-fallback');
      expect(mockPrisma.staticQuestion.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('pushQuestionsToPool', () => {
    const QUESTIONS = [
      { question: 'Q1?', options: ['A','B'], answer: 'A' },
      { question: 'Q2?', options: ['C','D'], answer: 'C' },
    ];

    it('deve lançar NotFoundException para vídeo inexistente', async () => {
      mockPrisma.video.findUnique.mockResolvedValue(null);
      await expect(service.pushQuestionsToPool('bad-id', QUESTIONS)).rejects.toThrow(NotFoundException);
    });

    it('deve persistir no banco e empurrar no Redis', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({ id: 'vid-1' });
      mockPrisma.generatedQuestion.create
        .mockResolvedValueOnce({ id: 'db-q1', ...QUESTIONS[0] })
        .mockResolvedValueOnce({ id: 'db-q2', ...QUESTIONS[1] });
      mockPool.pushQuestions.mockResolvedValue(2);

      const result = await service.pushQuestionsToPool('vid-1', QUESTIONS);

      expect(mockPrisma.generatedQuestion.create).toHaveBeenCalledTimes(2);
      expect(mockPool.pushQuestions).toHaveBeenCalledWith('vid-1', [
        { id: 'db-q1', ...QUESTIONS[0] },
        { id: 'db-q2', ...QUESTIONS[1] },
      ]);
      expect(result).toEqual({ pushed: 2 });
    });

    it('deve armazenar embedding via raw SQL quando fornecido com 1536 dimensões', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({ id: 'vid-1' });
      mockPrisma.generatedQuestion.create.mockResolvedValue({ id: 'db-q1', ...QUESTIONS[0] });
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPool.pushQuestions.mockResolvedValue(1);

      await service.pushQuestionsToPool('vid-1', [{ ...QUESTIONS[0], embedding: new Array(1536).fill(0.01) }]);

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('deve ignorar embedding com dimensões incorretas', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({ id: 'vid-1' });
      mockPrisma.generatedQuestion.create.mockResolvedValue({ id: 'db-q1', ...QUESTIONS[0] });
      mockPool.pushQuestions.mockResolvedValue(1);

      await service.pushQuestionsToPool('vid-1', [{ ...QUESTIONS[0], embedding: new Array(512).fill(0.1) }]);

      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('getPoolSize', () => {
    it('deve retornar o tamanho do pool com o videoId', async () => {
      mockPool.getPoolSize.mockResolvedValue(9);
      expect(await service.getPoolSize('vid-1')).toEqual({ videoId: 'vid-1', size: 9 });
    });
  });
});
