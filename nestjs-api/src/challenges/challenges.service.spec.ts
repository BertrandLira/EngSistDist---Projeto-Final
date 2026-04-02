import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChallengesService } from './challenges.service';
import { Challenge } from '../database/entities/challenge.entity';
import { StaticFallbackQuestion } from '../database/entities/static-question.entity';
import { PoolService } from '../pool/pool.service';
import { DeliveryEventsService } from './delivery-events.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

const mockChallengeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  query: jest.fn(),
});

const mockStaticRepo = () => ({
  count: jest.fn(),
  find: jest.fn(),
});

const mockPoolService = () => ({
  popQuestion: jest.fn(),
  pushQuestions: jest.fn().mockResolvedValue(0),
  getPoolSize: jest.fn(),
  clearPool: jest.fn(),
});

const mockDeliveryEvents = () => ({
  record: jest.fn(),
});

const mockRabbitMQ = () => ({
  publish: jest.fn(),
});

describe('ChallengesService', () => {
  let service: ChallengesService;
  let challengeRepo: ReturnType<typeof mockChallengeRepo>;
  let staticRepo: ReturnType<typeof mockStaticRepo>;
  let poolService: ReturnType<typeof mockPoolService>;
  let deliveryEvents: ReturnType<typeof mockDeliveryEvents>;
  let rabbitMQ: ReturnType<typeof mockRabbitMQ>;

  const videoId = 'video-uuid-123';

  const makeChallenge = (overrides = {}): Challenge => ({
    id: 'challenge-uuid-1',
    videoId,
    prompt: 'O que foi apresentado no vídeo?',
    options: ['Opção A', 'Opção B', 'Opção C', 'Opção D'],
    answer: 'Opção A',
    embedding: null,
    source: 'ai',
    consumed: false,
    createdAt: new Date(),
    video: {} as any,
    ...overrides,
  });

  const makeStaticQuestion = (): StaticFallbackQuestion => ({
    id: 'static-uuid-1',
    prompt: 'Pergunta genérica de fallback',
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    createdAt: new Date(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengesService,
        { provide: getRepositoryToken(Challenge), useFactory: mockChallengeRepo },
        { provide: getRepositoryToken(StaticFallbackQuestion), useFactory: mockStaticRepo },
        { provide: PoolService, useFactory: mockPoolService },
        { provide: DeliveryEventsService, useFactory: mockDeliveryEvents },
        { provide: RabbitMQService, useFactory: mockRabbitMQ },
      ],
    }).compile();

    service = module.get(ChallengesService);
    challengeRepo = module.get(getRepositoryToken(Challenge));
    staticRepo = module.get(getRepositoryToken(StaticFallbackQuestion));
    poolService = module.get(PoolService);
    deliveryEvents = module.get(DeliveryEventsService);
    rabbitMQ = module.get(RabbitMQService);
  });

  describe('Circuit Breaker — getChallenge', () => {
    it('Camada 1 (Pool Redis): retorna desafio do pool quando disponível', async () => {
      const pooled = {
        id: 'pool-challenge-1',
        question: 'Pergunta do pool',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
      };
      poolService.popQuestion.mockResolvedValue(pooled);
      poolService.getPoolSize.mockResolvedValue(10);

      const result = await service.getChallenge(videoId);

      expect(result.source).toBe('pool');
      expect(result.id).toBe('pool-challenge-1');
      expect(poolService.popQuestion).toHaveBeenCalledWith(videoId);
      expect(challengeRepo.findOne).not.toHaveBeenCalled();
    });

    it('Camada 1 (Pool): dispara refresh via RabbitMQ quando pool está abaixo do threshold', async () => {
      const pooled = { id: 'p1', question: 'Q', options: [], answer: 'A' };
      poolService.popQuestion.mockResolvedValue(pooled);
      poolService.getPoolSize.mockResolvedValue(1); // abaixo de 2

      await service.getChallenge(videoId);

      expect(rabbitMQ.publish).toHaveBeenCalledWith({ videoId, amount: 5 });
    });

    it('Camada 1 (Pool): NÃO dispara refresh quando pool está cheio', async () => {
      const pooled = { id: 'p1', question: 'Q', options: [], answer: 'A' };
      poolService.popQuestion.mockResolvedValue(pooled);
      poolService.getPoolSize.mockResolvedValue(5); // acima do threshold

      await service.getChallenge(videoId);

      expect(rabbitMQ.publish).not.toHaveBeenCalled();
    });

    it('Camada 2 (DB/Vector): usa DB quando pool está vazio', async () => {
      poolService.popQuestion.mockResolvedValue(null);
      const challenge = makeChallenge();
      challengeRepo.findOne.mockResolvedValue(challenge);
      challengeRepo.update.mockResolvedValue(undefined);
      challengeRepo.query.mockResolvedValue([]); // sem cross-video
      rabbitMQ.publish.mockResolvedValue(undefined);

      const result = await service.getChallenge(videoId);

      expect(result.source).toBe('vector');
      expect(result.question).toBe(challenge.prompt);
      expect(challengeRepo.findOne).toHaveBeenCalled();
    });

    it('Camada 2 (DB): solicita refresh via RabbitMQ quando pool estava vazio', async () => {
      poolService.popQuestion.mockResolvedValue(null);
      const challenge = makeChallenge();
      challengeRepo.findOne.mockResolvedValue(challenge);
      challengeRepo.update.mockResolvedValue(undefined);
      challengeRepo.query.mockResolvedValue([]);
      rabbitMQ.publish.mockResolvedValue(undefined);

      await service.getChallenge(videoId);

      expect(rabbitMQ.publish).toHaveBeenCalledWith({ videoId, amount: 5 });
    });

    it('Camada 3 (Fallback estático): usa fallback quando pool e DB estão vazios', async () => {
      poolService.popQuestion.mockResolvedValue(null);
      challengeRepo.findOne.mockResolvedValue(null);
      challengeRepo.query.mockResolvedValue([]);
      const staticQ = makeStaticQuestion();
      staticRepo.count.mockResolvedValue(1);
      staticRepo.find.mockResolvedValue([staticQ]);
      rabbitMQ.publish.mockResolvedValue(undefined);

      const result = await service.getChallenge(videoId);

      expect(result.source).toBe('static');
      expect(result.id).toBe(staticQ.id);
    });

    it('Camada 3 (Fallback): usa pergunta hardcoded quando banco estático está vazio', async () => {
      poolService.popQuestion.mockResolvedValue(null);
      challengeRepo.findOne.mockResolvedValue(null);
      challengeRepo.query.mockResolvedValue([]);
      staticRepo.count.mockResolvedValue(0);
      rabbitMQ.publish.mockResolvedValue(undefined);

      const result = await service.getChallenge(videoId);

      expect(result.source).toBe('static');
      expect(result.id).toBe('hardcoded-fallback');
    });

    it('Registra entrega em todos os cenários', async () => {
      poolService.popQuestion.mockResolvedValue({
        id: 'p1', question: 'Q', options: [], answer: 'A',
      });
      poolService.getPoolSize.mockResolvedValue(5);

      await service.getChallenge(videoId);

      expect(deliveryEvents.record).toHaveBeenCalledWith(
        videoId,
        expect.objectContaining({ source: 'pool' }),
      );
    });

    it('Continua funcionando mesmo se Redis lançar erro (Circuit Breaker degrada para DB)', async () => {
      poolService.popQuestion.mockRejectedValue(new Error('Redis connection refused'));
      const challenge = makeChallenge();
      challengeRepo.findOne.mockResolvedValue(challenge);
      challengeRepo.update.mockResolvedValue(undefined);
      challengeRepo.query.mockResolvedValue([]);
      rabbitMQ.publish.mockResolvedValue(undefined);

      const result = await service.getChallenge(videoId);

      expect(result.source).toBe('vector');
    });
  });

  describe('pushQuestionsToPool', () => {
    it('Salva perguntas no banco e empurra no pool Redis', async () => {
      const questions = [
        { question: 'P1', options: ['A', 'B'], answer: 'A', embedding: [] },
      ];
      const savedChallenge = makeChallenge();
      challengeRepo.create.mockReturnValue(savedChallenge);
      challengeRepo.save.mockResolvedValue(savedChallenge);
      challengeRepo.query.mockResolvedValue(undefined);
      poolService.pushQuestions.mockResolvedValue(1);

      const result = await service.pushQuestionsToPool(videoId, questions);

      expect(result.pushed).toBe(1);
      expect(challengeRepo.create).toHaveBeenCalled();
      expect(challengeRepo.save).toHaveBeenCalled();
      expect(poolService.pushQuestions).toHaveBeenCalled();
    });

    it('Retorna pushed=0 para lista vazia', async () => {
      const result = await service.pushQuestionsToPool(videoId, []);

      expect(result.pushed).toBe(0);
      expect(challengeRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getPoolSize', () => {
    it('Retorna o tamanho atual do pool', async () => {
      poolService.getPoolSize.mockResolvedValue(7);

      const result = await service.getPoolSize(videoId);

      expect(result).toEqual({ videoId, size: 7 });
    });

    it('Retorna size=0 quando Redis falha', async () => {
      poolService.getPoolSize.mockRejectedValue(new Error('Redis error'));

      const result = await service.getPoolSize(videoId);

      expect(result).toEqual({ videoId, size: 0 });
    });
  });
});
