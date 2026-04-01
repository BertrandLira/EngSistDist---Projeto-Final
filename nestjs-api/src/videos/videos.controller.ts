import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { VideosService } from "./videos.service";

@Controller("videos")
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Missing file");
    }
    const { record } = await this.videos.saveUploadedFile(file);
    return {
      id: record.id,
      originalName: record.originalName,
      createdAt: record.createdAt,
      transcriptJobStatus: record.transcriptJobStatus ?? null,
    };
  }

  @Get()
  async list() {
    const videos = await this.videos.listVideos();
    return videos.map((v) => ({
      id: v.id,
      originalName: v.originalName,
      createdAt: v.createdAt,
      hasTranscript: Boolean(v.transcript),
      transcriptMode: v.transcriptMode ?? null,
      transcriptJobStatus: v.transcriptJobStatus ?? null,
    }));
  }

  @Get(":id/transcript-status")
  async transcriptStatus(@Param("id") id: string) {
    return this.videos.getTranscriptJobStatus(id);
  }

  @Get(":id/stream")
  async stream(
    @Param("id") id: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const range = req.headers.range;
    await this.videos.streamVideo(id, range, res);
  }

  @Post(":id/challenges")
  async challenges(@Param("id") id: string) {
    try {
      const challenge: any = await this.videos.requestChallenges(id);
      // Frontend expects array of questions, and 'prompt' instead of 'question'
      return { 
        questions: [{
          ...challenge,
          prompt: challenge.question || challenge.prompt
        }],
        provider: "circuit-breaker"
      };
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      throw new ServiceUnavailableException((e as Error).message);
    }
  }
}
