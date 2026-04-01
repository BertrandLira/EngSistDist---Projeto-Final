import pika
import json

def generate_challenge(video_id):
    print(f"Gerando desafio para vídeo {video_id}")
    # aqui vai sua lógica de IA


def start_worker():

    connection = pika.BlockingConnection(
        pika.ConnectionParameters("rabbitmq")
    )

    channel = connection.channel()

    channel.queue_declare(
        queue="challenge_generation",
        durable=True
    )

    def callback(ch, method, properties, body):

        data = json.loads(body)

        print("Mensagem recebida:", data)

        try:

            video_id = data["videoId"]

            generate_challenge(video_id)

            ch.basic_ack(
                delivery_tag=method.delivery_tag
            )

        except Exception as e:

            print("Erro:", e)

            ch.basic_nack(
                delivery_tag=method.delivery_tag
            )

    channel.basic_consume(
        queue="challenge_generation",
        on_message_callback=callback
    )

    print("Worker iniciado...")

    channel.start_consuming()