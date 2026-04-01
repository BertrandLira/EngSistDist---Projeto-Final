import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.ai_service import get_ai_provider
from app.services import db_client
from app.services.transcribe_pipeline import transcribe_video_file_with_audit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["jobs"])


class TranscribeJobBody(BaseModel):
    video_id: str = Field(..., min_length=1)
    relative_path: str = Field(..., min_length=1)


class QuestionsJobBody(BaseModel):
    video_id: str = Field(..., min_length=1)
    relative_path: str = Field(..., min_length=1)
    count: int = Field(default=5, ge=1, le=20)


def _resolve_path(relative_path: str) -> Path:
    root = Path(settings.media_root).resolve()
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid path") from exc
    return candidate


@router.post("/jobs/transcribe")
def transcribe_job(body: TranscribeJobBody):
    path = _resolve_path(body.relative_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found on worker volume")
    try:
        text, mode, log_entries, scene_desc = transcribe_video_file_with_audit(path)
        db_client.update_video_transcript_full(
            body.video_id, text, mode, log_entries, scene_description=scene_desc
        )
    except Exception as exc:
        logger.exception("Transcrição HTTP falhou")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "job_id": str(uuid.uuid4()),
        "video_id": body.video_id,
        "status": "completed",
        "transcript": text,
    }


@router.post("/jobs/questions")
def questions_job(body: QuestionsJobBody):
    path = _resolve_path(body.relative_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found on worker volume")

    # Busca transcrição e descrição de cenas do banco
    video = db_client.get_video(body.video_id)
    transcript = video["transcript"] if video else ""
    scene_description = video["scene_description"] if video else ""

    if not transcript and not scene_description:
        logger.warning("Vídeo %s sem transcrição nem descrição de cenas, gerando com contexto mínimo", body.video_id)
        transcript = f"Vídeo: {path.name}"

    # Gera perguntas via IA (Gemini ou OpenAI) + auditoria prompt/resposta
    try:
        provider = get_ai_provider()
        questions, prompt_text, response_raw = provider.generate_questions_with_raw(
            transcript=transcript,
            scene_description=scene_description,
            count=body.count,
        )
        model_name = getattr(provider, "model", None) or settings.ai_model or ""
    except Exception as exc:
        logger.exception("Falha na geração de perguntas via IA")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}") from exc

    if not questions:
        raise HTTPException(status_code=502, detail="IA retornou 0 perguntas")

    # Gera embeddings para cada pergunta
    try:
        embeddings = [provider.generate_embedding(q["prompt"]) for q in questions]
    except Exception as exc:
        logger.exception("Falha na geração de embeddings")
        raise HTTPException(status_code=502, detail=f"Embedding generation failed: {exc}") from exc

    # Salva no Postgres (tabela challenges)
    try:
        challenge_ids = db_client.save_challenges(body.video_id, questions, embeddings)
    except Exception as exc:
        logger.exception("Falha ao salvar desafios no banco")
        raise HTTPException(status_code=500, detail=f"DB save failed: {exc}") from exc

    try:
        db_client.insert_ai_question_generation_log(
            body.video_id,
            settings.ai_provider,
            model_name,
            prompt_text,
            response_raw,
        )
    except Exception as exc:
        logger.warning("Auditoria IA não persistida: %s", exc)

    return {
        "job_id": str(uuid.uuid4()),
        "video_id": body.video_id,
        "provider": settings.ai_provider,
        "questions": [
            {
                "id": cid,
                "prompt": q["prompt"],
                "options": q.get("options"),
                "answer": q.get("answer"),
            }
            for cid, q in zip(challenge_ids, questions)
        ],
    }
