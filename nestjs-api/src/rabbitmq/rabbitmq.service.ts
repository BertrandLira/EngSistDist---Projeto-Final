import { Injectable, OnModuleInit } from "@nestjs/common";
import * as amqp from "amqplib";

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;

  async onModuleInit() {
    await this.connect();
    console.log("RabbitMQ conectado");
  }

  async connect() {
    let retries = 10;
    while (retries > 0) {
      try {
        this.connection = await amqp.connect("amqp://rabbitmq:5672");
        this.channel = await this.connection.createChannel();

        await this.channel.assertQueue("challenge_generation", {
          durable: true,
        });
        return;
      } catch (err) {
        retries--;
        console.error(
          `Erro ao conectar no RabbitMQ (tentativa ${10 - retries}/10): ${err.message}`,
        );
        if (retries === 0) throw err;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async publish(message: any) {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    this.channel.sendToQueue(
      "challenge_generation",
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }
}