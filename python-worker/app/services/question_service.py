import logging
import random

from app.core.config import settings
from app.services.ai_service import get_ai_provider, QUESTION_ANGLES
from app.services import db_client

logger = logging.getLogger(__name__)


def generate_and_save_questions(video_id: str, count: int = 5):
    """
    Busca transcrição, gera perguntas via IA com anti-repetição, calcula embeddings e salva.

    Melhorias de variabilidade:
      1. Busca perguntas já geradas → inclui no prompt para evitar repetição.
      2. Sorteia um ângulo de questionamento diferente a cada chamada.
      3. Temperature 0.9 (configurado no provider).
    """
    # Busca transcrição e descrição de cenas do banco
    video = db_client.get_video(video_id)
    transcript = video["transcript"] if video else ""
    scene_description = video["scene_description"] if video else ""

    if not transcript and not scene_description:
        logger.warning("Vídeo %s sem transcrição nem descrição de cenas, gerando com contexto mínimo", video_id)
        transcript = f"Vídeo ID: {video_id}"

    # Busca perguntas já geradas para evitar repetição
    existing_questions = db_client.get_existing_questions(video_id)
    if existing_questions:
        logger.info(
            "Vídeo %s já tem %d perguntas geradas — passando ao prompt para evitar repetição.",
            video_id, len(existing_questions),
        )

    # Sorteia ângulo de questionamento
    angle = random.choice(QUESTION_ANGLES)
    logger.info("Ângulo sorteado para vídeo %s: %s", video_id, angle["name"])

    # Gera perguntas via IA + auditoria prompt/resposta
    provider = get_ai_provider()
    questions, prompt_text, response_raw = provider.generate_questions_with_raw(
        transcript=transcript,
        scene_description=scene_description,
        count=count,
        existing_questions=existing_questions,
        angle=angle,
    )
    model_name = getattr(provider, "model", None) or settings.ai_model or ""

    if not questions:
        raise ValueError("IA retornou 0 perguntas")

    # Gera embeddings para cada pergunta
    embeddings = [provider.generate_embedding(q["prompt"]) for q in questions]

    # Salva no Postgres (tabela challenges)
    challenge_ids = db_client.save_challenges(video_id, questions, embeddings)

    # Log de auditoria
    try:
        db_client.insert_ai_question_generation_log(
            video_id,
            settings.ai_provider,
            model_name,
            prompt_text,
            response_raw,
        )
    except Exception as exc:
        logger.warning("Auditoria IA não persistida: %s", exc)

    return [
        {
            "id": cid,
            "prompt": q["prompt"],
            "options": q.get("options"),
            "answer": q.get("answer"),
        }
        for cid, q in zip(challenge_ids, questions)
    ]
