"""
Cliente Postgres para salvar perguntas geradas na tabela challenges.
"""

from __future__ import annotations

import logging
import uuid

import psycopg2
from psycopg2.extras import execute_values

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_connection():
    return psycopg2.connect(settings.database_url)


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
