import pika
import json
import requests

from app.services.ai_service import get_ai_provider

API_URL = "http://nestjs-api:4000/challenges/pool"

ai = get_ai_provider()


def generate_challenge(video_id, count=5):

    print(f"Gerando {count} perguntas para vídeo {video_id}")

    # nesse exemplo não temos transcript/scene
    transcript = ""
    scene_description = ""

    questions = ai.generate_questions(
        transcript=transcript,
        scene_description=scene_description,
        count=count
    )

    result = []

    for q in questions:

        question_text = q["prompt"]

        embedding = ai.generate_embedding(question_text)

        result.append({
            "question": question_text,
            "options": q["options"],
            "answer": q["answer"],
            "embedding": embedding
        })

    return result


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


def start_worker():

    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host="localhost")
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
            amount = data.get("amount", 5)

            questions = generate_challenge(video_id, amount)

            send_to_api(video_id, questions)

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


if __name__ == "__main__":
    start_worker()