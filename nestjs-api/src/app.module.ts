import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { VideosModule } from "./videos/videos.module";
import { ChallengesModule } from "./challenges/challenges.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    VideosModule,
    ChallengesModule,
  ],
})
export class AppModule {}


