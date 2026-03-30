import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PoolService, PoolQuestion } from './pool.service';

// ---- Mock global do módulo ioredis ----------------------------------------
const mockRedis = {
  rpush: jest.fn(),
  lpop: jest.fn(),
  llen: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => mockRedis),
);
// ---------------------------------------------------------------------------

const QUESTION: PoolQuestion = {
  id: 'q-uuid-1',
  question: 'Qual o tema do vídeo?',
  options: ['Tecnologia', 'Saúde', 'Esporte', 'Arte'],
  answer: 'Tecnologia',
};

describe('PoolService', () => {
  let service: PoolService;

  const mockConfig = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoolService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<PoolService>(PoolService);
  });

  // ---------- pushQuestions -------------------------------------------------
  describe('pushQuestions', () => {
    it('should push a single question and return pool size', async () => {
      mockRedis.rpush.mockResolvedValue(1);
      const size = await service.pushQuestions('vid-1', [QUESTION]);
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        'pool:video:vid-1',
        JSON.stringify(QUESTION),
      );
      expect(size).toBe(1);
    });

    it('should push multiple questions in a single RPUSH call', async () => {
      mockRedis.rpush.mockResolvedValue(2);
      const q2: PoolQuestion = { ...QUESTION, id: 'q-uuid-2' };
      await service.pushQuestions('vid-1', [QUESTION, q2]);
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        'pool:video:vid-1',
        JSON.stringify(QUESTION),
        JSON.stringify(q2),
      );
    });

    it('should return 0 and skip Redis when list is empty', async () => {
      const size = await service.pushQuestions('vid-1', []);
      expect(mockRedis.rpush).not.toHaveBeenCalled();
      expect(size).toBe(0);
    });
  });

  // ---------- popQuestion ---------------------------------------------------
  describe('popQuestion', () => {
    it('should return parsed question when pool has items', async () => {
      mockRedis.lpop.mockResolvedValue(JSON.stringify(QUESTION));
      const result = await service.popQuestion('vid-1');
      expect(result).toEqual(QUESTION);
      expect(mockRedis.lpop).toHaveBeenCalledWith('pool:video:vid-1');
    });

    it('should return null when pool is empty', async () => {
      mockRedis.lpop.mockResolvedValue(null);
      const result = await service.popQuestion('vid-1');
      expect(result).toBeNull();
    });
  });

  // ---------- getPoolSize ---------------------------------------------------
  describe('getPoolSize', () => {
    it('should return the Redis LLEN value', async () => {
      mockRedis.llen.mockResolvedValue(7);
      const size = await service.getPoolSize('vid-1');
      expect(size).toBe(7);
      expect(mockRedis.llen).toHaveBeenCalledWith('pool:video:vid-1');
    });

    it('should return 0 for an empty pool', async () => {
      mockRedis.llen.mockResolvedValue(0);
      expect(await service.getPoolSize('vid-1')).toBe(0);
    });
  });

  // ---------- clearPool -----------------------------------------------------
  describe('clearPool', () => {
    it('should delete the Redis key', async () => {
      mockRedis.del.mockResolvedValue(1);
      await service.clearPool('vid-1');
      expect(mockRedis.del).toHaveBeenCalledWith('pool:video:vid-1');
    });
  });

  // ---------- onModuleDestroy -----------------------------------------------
  describe('onModuleDestroy', () => {
    it('should call redis.quit()', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });
  });
});
