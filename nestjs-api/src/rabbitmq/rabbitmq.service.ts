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
    this.connection = await amqp.connect("amqp://rabbitmq:5672");
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue("challenge_generation", {
      durable: true,
    });
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