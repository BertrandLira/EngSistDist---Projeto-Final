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


from app.services.question_service import generate_and_save_questions

@router.post("/jobs/questions")
def questions_job(body: QuestionsJobBody):
    path = _resolve_path(body.relative_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found on worker volume")

    try:
        results = generate_and_save_questions(
            video_id=body.video_id,
            count=body.count
        )
        return {
            "job_id": str(uuid.uuid4()),
            "video_id": body.video_id,
            "provider": settings.ai_provider,
            "questions": results,
        }
    except Exception as exc:
        logger.exception("Falha na geração de perguntas via IA (HTTP)")
        raise HTTPException(status_code=502, detail=f"Generation failed: {exc}") from exc
