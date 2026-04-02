import pika
import json
import requests
import logging

from app.services.ai_service import get_ai_provider

logger = logging.getLogger(__name__)

API_URL = "http://nestjs-api:4000/challenges/pool"

ai = get_ai_provider()


from app.services.question_service import generate_and_save_questions

def generate_challenge(video_id, count=5):
    """
    Usa o shared service para gerar e salvar perguntas no Postgres.
    """
    logger.info(f"Processando RabbitMQ: Gerando {count} perguntas para vídeo {video_id}")
    
    # generate_and_save_questions já busca o transcript no DB e salva no Postgres
    results = generate_and_save_questions(video_id, count=count)
    return results


def send_to_api(video_id, questions):

    payload = {
        "videoId": video_id,
        "questions": questions
    }

    try:

        response = requests.post(
            f"{API_URL}/{video_id}/questions",
            json={
                "questions": questions
            }
        )

        print("Perguntas enviadas:", response.status_code)

    except Exception as e:

        print("Erro enviando para API:", e)


from app.core.config import settings

import time

def start_worker():
    max_retries = 10
    retry_delay = 5
    connection = None

    for i in range(max_retries):
        try:
            logger.info("Tentativa de conexão RabbitMQ %d/%d em %s", i + 1, max_retries, settings.rabbitmq_url)
            parameters = pika.URLParameters(settings.rabbitmq_url)
            connection = pika.BlockingConnection(parameters)
            logger.info("Conectado ao RabbitMQ com sucesso!")
            break
        except pika.exceptions.AMQPConnectionError as e:
            logger.warning("Falha ao conectar ao RabbitMQ (tentativa %d/%d): %s", i + 1, max_retries, e)
            if i < max_retries - 1:
                time.sleep(retry_delay)
            else:
                logger.error("Máximo de tentativas atingido. Encerrando.")
                raise

    if not connection:
        return

    channel = connection.channel()

    channel.queue_declare(
        queue="challenge_generation",
        durable=True
    )

    def callback(ch, method, properties, body):
        data = json.loads(body)
        logger.info("Mensagem RabbitMQ recebida: %s", data)

        try:
            video_id = data["videoId"]
            amount = data.get("amount", 5)

            # Gera e salva no Postgres
            generate_challenge(video_id, amount)

            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception:
            logger.exception("Erro ao processar desafio via RabbitMQ")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    channel.basic_consume(
        queue="challenge_generation",
        on_message_callback=callback
    )

    print("Worker iniciado...")

    channel.start_consuming()


if __name__ == "__main__":
    start_worker()