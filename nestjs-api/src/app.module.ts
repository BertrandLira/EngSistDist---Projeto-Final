import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./redis/redis.module";
import { VideosModule } from "./videos/videos.module";
import { ChallengesModule } from "./challenges/challenges.module";
import { RabbitMQModule } from "./rabbitmq/rabbitmq.module";
import { StatsModule } from "./stats/stats.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    DatabaseModule,
    HealthModule,
    VideosModule,
    ChallengesModule,
    RabbitMQModule,
    StatsModule,
  ],
})
export class AppModule {}


