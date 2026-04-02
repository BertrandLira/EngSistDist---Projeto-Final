import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RabbitMQService } from "./rabbitmq/rabbitmq.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: true, credentials: true });

  const rabbit = new RabbitMQService();
  await rabbit.connect();

  const port = Number(process.env.PORT) || 4000;

  await app.listen(port, "0.0.0.0");
}

bootstrap();