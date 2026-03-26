import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 512 * 1024 * 1024 },
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
