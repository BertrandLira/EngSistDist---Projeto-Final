import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { VideosService, TRANSCRIBE_QUEUE_KEY } from './videos.service';
import { Video } from '../database/entities/video.entity';
import { ChallengesService } from '../challenges/challenges.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const mockVideoRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockRedis = () => ({
  lpush: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
});

const mockChallengesService = () => ({
  getChallenge: jest.fn(),
});

const makeVideo = (overrides = {}): Video => ({
  id: 'video-uuid-1',
  originalName: 'test.mp4',
  mimeType: 'video/mp4',
  relativePath: 'video-uuid-1.mp4',
  transcript: 'Transcrição de teste',
  sceneDescription: null,
  transcriptMode: null,
  transcriptGeneratedAt: null,
  transcriptGenerationLog: null,
  transcriptJobStatus: 'queued',
  createdAt: new Date(),
  challenges: [],
  ...overrides,
});

describe('VideosService', () => {
  let service: VideosService;
  let videoRepo: ReturnType<typeof mockVideoRepo>;
  let redis: ReturnType<typeof mockRedis>;
  let challengesService: ReturnType<typeof mockChallengesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideosService,
        { provide: getRepositoryToken(Video), useFactory: mockVideoRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'UPLOAD_DIR') return '/tmp/uploads';
              if (key === 'PYTHON_WORKER_URL') return 'http://localhost:8000';
              return undefined;
            }),
          },
        },
        { provide: REDIS_CLIENT, useFactory: mockRedis },
        { provide: ChallengesService, useFactory: mockChallengesService },
      ],
    }).compile();

    service = module.get(VideosService);
    videoRepo = module.get(getRepositoryToken(Video));
    redis = module.get(REDIS_CLIENT);
    challengesService = module.get(ChallengesService);
  });

  describe('listVideos', () => {
    it('Retorna todos os vídeos ordenados por data', async () => {
      const videos = [makeVideo({ id: 'v1' }), makeVideo({ id: 'v2' })];
      videoRepo.find.mockResolvedValue(videos);

      const result = await service.listVideos();

      expect(result).toHaveLength(2);
      expect(videoRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('Retorna lista vazia quando não há vídeos', async () => {
      videoRepo.find.mockResolvedValue([]);

      const result = await service.listVideos();

      expect(result).toEqual([]);
    });
  });

  describe('getRecord', () => {
    it('Retorna o vídeo quando encontrado', async () => {
      const video = makeVideo();
      videoRepo.findOne.mockResolvedValue(video);

      const result = await service.getRecord(video.id);

      expect(result).toEqual(video);
      expect(videoRepo.findOne).toHaveBeenCalledWith({
        where: { id: video.id },
      });
    });

    it('Lança NotFoundException quando vídeo não existe', async () => {
      videoRepo.findOne.mockResolvedValue(null);

      await expect(service.getRecord('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTranscriptJobStatus', () => {
    it('Retorna status do job de transcrição', async () => {
      const date = new Date('2025-01-01T10:00:00Z');
      const video = makeVideo({
        transcriptJobStatus: 'completed',
        transcriptMode: 'gemini',
        transcriptGeneratedAt: date,
      });
      videoRepo.findOne.mockResolvedValue(video);

      const result = await service.getTranscriptJobStatus(video.id);

      expect(result.status).toBe('completed');
      expect(result.transcriptMode).toBe('gemini');
      expect(result.transcriptGeneratedAt).toBe(date.toISOString());
    });

    it('Retorna nulls quando transcrição ainda não foi gerada', async () => {
      const video = makeVideo({
        transcriptJobStatus: null,
        transcriptMode: null,
        transcriptGeneratedAt: null,
      });
      videoRepo.findOne.mockResolvedValue(video);

      const result = await service.getTranscriptJobStatus(video.id);

      expect(result.status).toBeNull();
      expect(result.transcriptMode).toBeNull();
      expect(result.transcriptGeneratedAt).toBeNull();
    });
  });

  describe('Cache-Aside — getTranscript', () => {
    it('Retorna transcript do cache Redis (HIT)', async () => {
      redis.get.mockResolvedValue('Texto em cache');

      const result = await service.getTranscript('video-1');

      expect(result).toBe('Texto em cache');
      expect(videoRepo.findOne).not.toHaveBeenCalled();
    });

    it('Busca no DB e armazena no Redis quando cache MISS', async () => {
      redis.get.mockResolvedValue(null);
      const video = makeVideo({ transcript: 'Transcrição real do vídeo' });
      videoRepo.findOne.mockResolvedValue(video);
      redis.setex.mockResolvedValue('OK');

      const result = await service.getTranscript(video.id);

      expect(result).toBe('Transcrição real do vídeo');
      expect(redis.setex).toHaveBeenCalledWith(
        `transcript:${video.id}`,
        3600,
        'Transcrição real do vídeo',
      );
    });

    it('Retorna null e não armazena no Redis se vídeo não tem transcript', async () => {
      redis.get.mockResolvedValue(null);
      const video = makeVideo({ transcript: null });
      videoRepo.findOne.mockResolvedValue(video);

      const result = await service.getTranscript(video.id);

      expect(result).toBeNull();
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('Continua funcionando mesmo com Redis indisponível (cache MISS gracioso)', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const video = makeVideo({ transcript: 'Transcrição mesmo sem Redis' });
      videoRepo.findOne.mockResolvedValue(video);
      redis.setex.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.getTranscript(video.id);

      expect(result).toBe('Transcrição mesmo sem Redis');
    });
  });

  describe('invalidateTranscriptCache', () => {
    it('Deleta a chave de cache do Redis', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidateTranscriptCache('video-1');

      expect(redis.del).toHaveBeenCalledWith('transcript:video-1');
    });

    it('Não propaga erros do Redis ao invalidar', async () => {
      redis.del.mockRejectedValue(new Error('Redis down'));

      await expect(service.invalidateTranscriptCache('video-1')).resolves.not.toThrow();
    });
  });

  describe('requestChallenges', () => {
    it('Delega ao ChallengesService após validar que o vídeo existe', async () => {
      const video = makeVideo();
      videoRepo.findOne.mockResolvedValue(video);
      const mockChallenge = {
        id: 'c1',
        question: 'Q?',
        options: ['A', 'B'],
        answer: 'A',
        source: 'pool',
      };
      challengesService.getChallenge.mockResolvedValue(mockChallenge);

      const result = await service.requestChallenges(video.id);

      expect(result).toEqual(mockChallenge);
      expect(challengesService.getChallenge).toHaveBeenCalledWith(video.id);
    });

    it('Lança NotFoundException quando vídeo não existe', async () => {
      videoRepo.findOne.mockResolvedValue(null);

      await expect(service.requestChallenges('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
