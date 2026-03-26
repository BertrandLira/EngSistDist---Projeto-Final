import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(tags=["jobs"])


class TranscribeJobBody(BaseModel):
    video_id: str = Field(..., min_length=1)
    relative_path: str = Field(..., min_length=1)


class QuestionsJobBody(BaseModel):
    video_id: str = Field(..., min_length=1)
    relative_path: str = Field(..., min_length=1)


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
    # Stub: real pipeline = ffmpeg extract audio + Whisper
    return {
        "job_id": str(uuid.uuid4()),
        "video_id": body.video_id,
        "status": "completed",
        "transcript": f"[stub transcript for {path.name}]",
    }


@router.post("/jobs/questions")
def questions_job(body: QuestionsJobBody):
    path = _resolve_path(body.relative_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found on worker volume")
    return {
        "job_id": str(uuid.uuid4()),
        "video_id": body.video_id,
        "questions": [
            {
                "id": str(uuid.uuid4()),
                "prompt": f"Stub question about {path.name}?",
            }
        ],
    }
