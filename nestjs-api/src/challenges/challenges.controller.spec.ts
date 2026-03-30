import { Test, TestingModule } from '@nestjs/testing';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

const mockService = {
  getChallenge: jest.fn(),
  pushQuestionsToPool: jest.fn(),
  getPoolSize: jest.fn(),
};

describe('ChallengesController', () => {
  let controller: ChallengesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChallengesController],
      providers: [{ provide: ChallengesService, useValue: mockService }],
    }).compile();
    controller = module.get<ChallengesController>(ChallengesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getChallenge', () => {
    it('deve delegar ao service e retornar o desafio', async () => {
      const challenge = {
        id: 'q1',
        question: 'Q?',
        options: ['A'],
        answer: 'A',
        source: 'pool',
      };
      mockService.getChallenge.mockResolvedValue(challenge);

      const result = await controller.getChallenge('vid-1');

      expect(result).toEqual(challenge);
      expect(mockService.getChallenge).toHaveBeenCalledWith('vid-1');
    });
  });

  describe('pushQuestions', () => {
    it('deve delegar ao service e retornar { pushed }', async () => {
      mockService.pushQuestionsToPool.mockResolvedValue({ pushed: 3 });
      const dto = {
        questions: [{ question: 'Q?', options: ['A'], answer: 'A' }],
      };

      const result = await controller.pushQuestions('vid-1', dto);

      expect(result).toEqual({ pushed: 3 });
      expect(mockService.pushQuestionsToPool).toHaveBeenCalledWith(
        'vid-1',
        dto.questions,
      );
    });
  });

  describe('poolSize', () => {
    it('deve retornar o tamanho do pool', async () => {
      mockService.getPoolSize.mockResolvedValue({ videoId: 'vid-1', size: 5 });

      const result = await controller.poolSize('vid-1');

      expect(result).toEqual({ videoId: 'vid-1', size: 5 });
      expect(mockService.getPoolSize).toHaveBeenCalledWith('vid-1');
    });
  });
});
