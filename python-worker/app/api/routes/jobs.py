import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(tags=["jobs"])

QUESTIONS_PROMPT = """
You are a quiz generator. Given a video transcript or description, generate exactly 5
multiple-choice questions to test viewer retention.

Respond ONLY with a JSON object in this exact format:
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A"
    }
  ]
}

Rules:
- Each question must have exactly 4 options.
- The answer must be one of the 4 options verbatim.
- Questions must be based strictly on the provided content.
- Write in the same language as the content.
"""


def _generate_with_openai(content: str) -> list[dict]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": QUESTIONS_PROMPT},
            {"role": "user", "content": content},
        ],
    )
    return json.loads(response.choices[0].message.content)["questions"]


def _generate_with_gemini(content: str) -> list[dict]:
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        generation_config={"response_mime_type": "application/json"},
        system_instruction=QUESTIONS_PROMPT,
    )
    response = model.generate_content(content)
    return json.loads(response.text)["questions"]


def _generate_questions(content: str) -> list[dict]:
    provider = settings.ai_provider.lower()
    if provider == "openai":
        if not settings.openai_api_key:
            raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")
        return _generate_with_openai(content)
    elif provider == "gemini":
        if not settings.gemini_api_key:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
        return _generate_with_gemini(content)
    else:
        raise HTTPException(
            status_code=503,
            detail=f"Unknown AI_PROVIDER '{provider}'. Use 'openai' or 'gemini'.",
        )


def _resolve_path(relative_path: str) -> Path:
    root = Path(settings.media_root).resolve()
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid path") from exc
    return candidate


class TranscribeJobBody(BaseModel):
    video_id: str = Field(..., min_length=1)
    relative_path: str = Field(..., min_length=1)


class QuestionsJobBody(BaseModel):
    video_id: str = Field(..., min_length=1)
    relative_path: str = Field(..., min_length=1)
    transcript: str | None = None


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

    content = body.transcript or f"Video file: {path.name}"

    try:
        questions = _generate_questions(content)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc

    return {
        "job_id": str(uuid.uuid4()),
        "video_id": body.video_id,
        "questions": questions,
    }
