import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PoolService, PoolQuestion } from './pool.service';

// Mock do ioredis
const mockRedis = {
  rpush: jest.fn(),
  lpop: jest.fn(),
  llen: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('PoolService', () => {
  let service: PoolService;

  const videoId = 'video-uuid-test';
  const poolKey = `pool:video:${videoId}`;

  const makeQuestion = (n = 1): PoolQuestion => ({
    id: `q-${n}`,
    question: `Pergunta ${n}`,
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.quit.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoolService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get(PoolService);
  });

  describe('pushQuestions', () => {
    it('Empurra perguntas na fila Redis e retorna novo tamanho', async () => {
      mockRedis.rpush.mockResolvedValue(3);
      const questions = [makeQuestion(1), makeQuestion(2), makeQuestion(3)];

      const size = await service.pushQuestions(videoId, questions);

      expect(size).toBe(3);
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        poolKey,
        ...questions.map((q) => JSON.stringify(q)),
      );
    });

    it('Retorna 0 e não chama Redis para lista vazia', async () => {
      const size = await service.pushQuestions(videoId, []);

      expect(size).toBe(0);
      expect(mockRedis.rpush).not.toHaveBeenCalled();
    });
  });

  describe('popQuestion', () => {
    it('Retorna a primeira pergunta da fila (FIFO)', async () => {
      const q = makeQuestion();
      mockRedis.lpop.mockResolvedValue(JSON.stringify(q));

      const result = await service.popQuestion(videoId);

      expect(result).toEqual(q);
      expect(mockRedis.lpop).toHaveBeenCalledWith(poolKey);
    });

    it('Retorna null quando o pool está vazio', async () => {
      mockRedis.lpop.mockResolvedValue(null);

      const result = await service.popQuestion(videoId);

      expect(result).toBeNull();
    });
  });

  describe('getPoolSize', () => {
    it('Retorna o número de itens na fila', async () => {
      mockRedis.llen.mockResolvedValue(5);

      const size = await service.getPoolSize(videoId);

      expect(size).toBe(5);
      expect(mockRedis.llen).toHaveBeenCalledWith(poolKey);
    });

    it('Retorna 0 quando a fila está vazia', async () => {
      mockRedis.llen.mockResolvedValue(0);

      const size = await service.getPoolSize(videoId);

      expect(size).toBe(0);
    });
  });

  describe('clearPool', () => {
    it('Remove todas as perguntas da fila', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.clearPool(videoId);

      expect(mockRedis.del).toHaveBeenCalledWith(poolKey);
    });
  });
});
