"""
Cliente Postgres para salvar perguntas geradas na tabela challenges.
"""

from __future__ import annotations

import json
import logging
import uuid

import psycopg2
from psycopg2.extras import execute_values

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_connection():
    return psycopg2.connect(settings.database_url)


def set_transcript_job_status(video_id: str, status: str) -> None:
    """Atualiza transcript_job_status (queued|processing|completed|failed)."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE videos SET transcript_job_status = %s WHERE id = %s::uuid
                """,
                (status, video_id),
            )
            conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("Erro ao atualizar transcript_job_status")
        raise
    finally:
        conn.close()


def update_video_transcript_full(
    video_id: str,
    transcript: str,
    mode: str,
    log_entries: list[dict],
    scene_description: str | None = None,
) -> None:
    """Persiste transcript, modo, status completed e append ao log JSON (auditoria)."""
    text = transcript if transcript is not None else ""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            if scene_description is not None:
                cur.execute(
                    """
                    UPDATE videos SET
                      transcript = %s,
                      transcript_mode = %s,
                      scene_description = %s,
                      transcript_generated_at = NOW(),
                      transcript_job_status = 'completed',
                      transcript_generation_log = COALESCE(transcript_generation_log, '[]'::jsonb) || %s::jsonb
                    WHERE id = %s::uuid
                    """,
                    (text, mode, scene_description, json.dumps(log_entries), video_id),
                )
            else:
                cur.execute(
                    """
                    UPDATE videos SET
                      transcript = %s,
                      transcript_mode = %s,
                      transcript_generated_at = NOW(),
                      transcript_job_status = 'completed',
                      transcript_generation_log = COALESCE(transcript_generation_log, '[]'::jsonb) || %s::jsonb
                    WHERE id = %s::uuid
                    """,
                    (text, mode, json.dumps(log_entries), video_id),
                )
            if cur.rowcount == 0:
                logger.warning("update_video_transcript_full: vídeo %s não encontrado", video_id)
            conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("Erro ao atualizar transcript")
        raise
    finally:
        conn.close()


def update_video_transcript(video_id: str, transcript: str) -> None:
    """Compat: só transcript + modo atual do env e log mínimo."""
    from app.core.config import settings

    update_video_transcript_full(
        video_id,
        transcript,
        settings.transcribe_mode,
        [{"event": "legacy", "message": "update_video_transcript"}],
    )


def insert_ai_question_generation_log(
    video_id: str,
    provider: str,
    model: str | None,
    prompt: str,
    response_raw: str,
) -> None:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_question_generation_logs (video_id, provider, model, prompt, response_raw)
                VALUES (%s::uuid, %s, %s, %s, %s)
                """,
                (video_id, provider, model or "", prompt, response_raw),
            )
            conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("Erro ao inserir ai_question_generation_logs")
        raise
    finally:
        conn.close()


def get_video(video_id: str) -> dict | None:
    """Busca metadados + transcrição de um vídeo."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, transcript, scene_description FROM videos WHERE id = %s",
                (video_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "transcript": row[1] or "",
                "scene_description": row[2] or "",
            }
    finally:
        conn.close()


def save_challenges(video_id: str, questions: list[dict], embeddings: list[list[float]]) -> list[str]:
    """Insere perguntas + embeddings na tabela challenges. Retorna lista de IDs."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            rows = []
            ids = []
            for q, emb in zip(questions, embeddings):
                challenge_id = str(uuid.uuid4())
                ids.append(challenge_id)
                # pgvector espera o embedding como string no formato '[0.01, 0.02, ...]'
                emb_str = "[" + ",".join(str(v) for v in emb) + "]"
                import json
                options_json = json.dumps(q.get("options")) if q.get("options") else None
                rows.append((
                    challenge_id,
                    video_id,
                    q["prompt"],
                    options_json,
                    q.get("answer"),
                    emb_str,
                    "ai",
                    False,
                ))

            execute_values(
                cur,
                """
                INSERT INTO challenges (id, video_id, prompt, options, answer, embedding, source, consumed)
                VALUES %s
                """,
                rows,
                template="(%s, %s::uuid, %s, %s::jsonb, %s, %s::vector, %s, %s)",
            )
            conn.commit()
            return ids
    except Exception:
        conn.rollback()
        logger.exception("Erro ao salvar challenges no banco")
        raise
    finally:
        conn.close()
