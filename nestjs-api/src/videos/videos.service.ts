import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type Redis from "ioredis";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { join } from "path";
import type { Response } from "express";
import { Video } from "../database/entities/video.entity";
import { ChallengesService } from "../challenges/challenges.service";
import { REDIS_CLIENT } from "../redis/redis.module";

/** Mesma chave que o consumidor Python em app/core/config.py */
export const TRANSCRIBE_QUEUE_KEY = "transcribe:jobs";

@Injectable()
export class VideosService {
  private readonly uploadDir: string;
  private readonly workerUrl: string;
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
    private readonly challengesService: ChallengesService,
  ) {
    this.uploadDir =
      this.config.get<string>("UPLOAD_DIR") ?? join(process.cwd(), "uploads");
    this.workerUrl =
      this.config.get<string>("PYTHON_WORKER_URL") ?? "http://localhost:8000";
  }

  async ensureUploadDir() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async saveUploadedFile(
    file: Express.Multer.File,
  ): Promise<{ record: Video }> {
    await this.ensureUploadDir();
    const id = randomUUID();
    const ext = this.extensionFromOriginal(file.originalname);
    const storedFilename = `${id}${ext}`;
    const dest = join(this.uploadDir, storedFilename);
    await fs.writeFile(dest, file.buffer);

    const record = this.videoRepo.create({
      id,
      originalName: file.originalname,
      mimeType: file.mimetype || "video/mp4",
      relativePath: storedFilename,
    });
    await this.videoRepo.save(record);

    try {
      await this.enqueueTranscribeJob(record);
      await this.videoRepo.update(
        { id: record.id },
        { transcriptJobStatus: "queued" },
      );
    } catch (err) {
      this.logger.warn(`Fila de transcrição: ${err}`);
      await this.videoRepo.update(
        { id: record.id },
        { transcriptJobStatus: "failed" },
      );
    }

    const saved = await this.videoRepo.findOne({ where: { id: record.id } });
    return { record: saved ?? record };
  }

  async listVideos(): Promise<Video[]> {
    return this.videoRepo.find({ order: { createdAt: "DESC" } });
  }

  async getRecord(id: string): Promise<Video> {
    const record = await this.videoRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Video ${id} not found`);
    }
    return record;
  }

  async getTranscriptJobStatus(id: string): Promise<{
    status: string | null;
    transcriptMode: string | null;
    transcriptGeneratedAt: string | null;
  }> {
    const record = await this.getRecord(id);
    return {
      status: record.transcriptJobStatus ?? null,
      transcriptMode: record.transcriptMode ?? null,
      transcriptGeneratedAt: record.transcriptGeneratedAt
        ? record.transcriptGeneratedAt.toISOString()
        : null,
    };
  }

  absolutePath(record: Video): string {
    return join(this.uploadDir, record.relativePath);
  }

  async streamVideo(
    id: string,
    rangeHeader: string | undefined,
    res: Response,
  ): Promise<void> {
    const record = await this.getRecord(id);
    const path = this.absolutePath(record);
    let stat;
    try {
      stat = await fs.stat(path);
    } catch {
      throw new NotFoundException("File missing on disk");
    }
    const fileSize = stat.size;
    const contentType = record.mimeType || "video/mp4";

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1;
      if (start >= fileSize || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      createReadStream(path, { start, end }).pipe(res);
      return;
    }

    res.status(200);
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");
    createReadStream(path).pipe(res);
  }

  /**
   * Solicita um desafio para o vídeo.
   * A lógica de pool, DB e refresh automático (via RabbitMQ) é delegada ao ChallengesService.
   */
  async requestChallenges(videoId: string): Promise<unknown> {
    await this.getRecord(videoId);
    return this.challengesService.getChallenge(videoId);
  }

  private extensionFromOriginal(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith(".mp4")) return ".mp4";
    if (lower.endsWith(".webm")) return ".webm";
    return ".mp4";
  }

  /** Publica job na lista Redis; o consumidor Python grava o transcript no Postgres. */
  private async enqueueTranscribeJob(record: Video): Promise<void> {
    const payload = JSON.stringify({
      video_id: record.id,
      relative_path: record.relativePath,
    });
    await this.redis.lpush(TRANSCRIBE_QUEUE_KEY, payload);
    this.logger.log(`Job de transcrição enfileirado para vídeo ${record.id}`);
  }
}
