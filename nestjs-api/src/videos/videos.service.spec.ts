import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { VideosService } from './videos.service';
import { PrismaService } from '../prisma/prisma.service';

// ---- Mock do módulo fs ----------------------------------------------------
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 2048 }),
  },
  createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
}));
// ---------------------------------------------------------------------------

const NOW = new Date('2025-01-01T00:00:00.000Z');

const DB_VIDEO = {
  id: 'vid-uuid',
  storedFilename: 'vid-uuid.mp4',
  originalName: 'meu-video.mp4',
  mimeType: 'video/mp4',
  createdAt: NOW,
  transcript: null,
  relativePath: 'vid-uuid.mp4',
};

const mockPrisma = {
  video: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      UPLOAD_DIR: '/tmp/test-uploads',
      PYTHON_WORKER_URL: 'http://localhost:8000',
    };
    return map[key];
  }),
};

describe('VideosService', () => {
  let service: VideosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Mock fetch global (usado por enqueueTranscribe)
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideosService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<VideosService>(VideosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------- listVideos ----------------------------------------------------
  describe('listVideos', () => {
    it('deve retornar lista mapeada do banco', async () => {
      mockPrisma.video.findMany.mockResolvedValue([DB_VIDEO]);

      const result = await service.listVideos();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('vid-uuid');
      expect(result[0].createdAt).toBe(NOW.toISOString());
      expect(mockPrisma.video.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('deve retornar lista vazia quando não há vídeos', async () => {
      mockPrisma.video.findMany.mockResolvedValue([]);
      expect(await service.listVideos()).toHaveLength(0);
    });
  });

  // ---------- getRecord -----------------------------------------------------
  describe('getRecord', () => {
    it('deve retornar o record quando encontrado', async () => {
      mockPrisma.video.findUnique.mockResolvedValue(DB_VIDEO);

      const record = await service.getRecord('vid-uuid');

      expect(record.id).toBe('vid-uuid');
      expect(record.originalName).toBe('meu-video.mp4');
      expect(record.transcript).toBeUndefined();
    });

    it('deve lançar NotFoundException quando vídeo não existe', async () => {
      mockPrisma.video.findUnique.mockResolvedValue(null);
      await expect(service.getRecord('nao-existe')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------- saveUploadedFile ----------------------------------------------
  describe('saveUploadedFile', () => {
    const FILE = {
      originalname: 'video-teste.mp4',
      buffer: Buffer.from('fake-video-content'),
      mimetype: 'video/mp4',
    } as Express.Multer.File;

    it('deve salvar arquivo no disco e persistir no banco', async () => {
      mockPrisma.video.create.mockResolvedValue({
        ...DB_VIDEO,
        originalName: 'video-teste.mp4',
      });

      const { record } = await service.saveUploadedFile(FILE);

      expect(record.originalName).toBe('video-teste.mp4');
      expect(mockPrisma.video.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalName: 'video-teste.mp4',
            mimeType: 'video/mp4',
          }),
        }),
      );
    });

    it('deve usar extensão .mp4 como padrão para arquivos desconhecidos', async () => {
      const unknownFile = { ...FILE, originalname: 'video.avi' } as Express.Multer.File;
      mockPrisma.video.create.mockResolvedValue({
        ...DB_VIDEO,
        originalName: 'video.avi',
      });

      await service.saveUploadedFile(unknownFile);

      const createCall = mockPrisma.video.create.mock.calls[0][0];
      expect(createCall.data.storedFilename).toMatch(/\.mp4$/);
    });

    it('deve usar extensão .webm para arquivos webm', async () => {
      const webmFile = { ...FILE, originalname: 'video.webm' } as Express.Multer.File;
      mockPrisma.video.create.mockResolvedValue({
        ...DB_VIDEO,
        originalName: 'video.webm',
      });

      await service.saveUploadedFile(webmFile);

      const createCall = mockPrisma.video.create.mock.calls[0][0];
      expect(createCall.data.storedFilename).toMatch(/\.webm$/);
    });
  });
});
