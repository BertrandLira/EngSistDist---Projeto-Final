import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { TypeOrmModule } from "@nestjs/typeorm";
import { memoryStorage } from "multer";
import { Video } from "../database/entities/video.entity";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 512 * 1024 * 1024 },
    }),
    TypeOrmModule.forFeature([Video]),
  ],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}

