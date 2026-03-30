import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { join } from "path";
import type { Response } from "express";
import { Video } from "../database/entities/video.entity";

@Injectable()
export class VideosService {
  private readonly uploadDir: string;
  private readonly workerUrl: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
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

    void this.enqueueTranscribe(record).catch(() => undefined);

    return { record };
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

  async requestChallenges(videoId: string): Promise<unknown> {
    const record = await this.getRecord(videoId);
    const url = `${this.workerUrl.replace(/\/$/, "")}/api/v1/jobs/questions`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: record.id,
        relative_path: record.relativePath,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Worker questions failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  private extensionFromOriginal(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith(".mp4")) return ".mp4";
    if (lower.endsWith(".webm")) return ".webm";
    return ".mp4";
  }

  private async enqueueTranscribe(record: Video): Promise<void> {
    const url = `${this.workerUrl.replace(/\/$/, "")}/api/v1/jobs/transcribe`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: record.id,
        relative_path: record.relativePath,
      }),
    });
    if (!res.ok) {
      return;
    }
    const body = (await res.json()) as { transcript?: string };
    if (body.transcript) {
      record.transcript = body.transcript;
      await this.videoRepo.save(record);
    }
  }
}
