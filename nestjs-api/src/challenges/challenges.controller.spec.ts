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

  it('getChallenge deve delegar ao service', async () => {
    const challenge = { id: 'q1', question: 'Q?', options: ['A'], answer: 'A', source: 'pool' };
    mockService.getChallenge.mockResolvedValue(challenge);
    expect(await controller.getChallenge('vid-1')).toEqual(challenge);
    expect(mockService.getChallenge).toHaveBeenCalledWith('vid-1');
  });

  it('pushQuestions deve delegar ao service', async () => {
    mockService.pushQuestionsToPool.mockResolvedValue({ pushed: 3 });
    const dto = { questions: [{ question: 'Q?', options: ['A'], answer: 'A' }] };
    expect(await controller.pushQuestions('vid-1', dto)).toEqual({ pushed: 3 });
    expect(mockService.pushQuestionsToPool).toHaveBeenCalledWith('vid-1', dto.questions);
  });

  it('poolSize deve retornar o tamanho do pool', async () => {
    mockService.getPoolSize.mockResolvedValue({ videoId: 'vid-1', size: 5 });
    expect(await controller.poolSize('vid-1')).toEqual({ videoId: 'vid-1', size: 5 });
  });
});
