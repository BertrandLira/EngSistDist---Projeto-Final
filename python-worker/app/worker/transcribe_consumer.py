"""
Consumidor bloqueante: BRPOP na fila Redis, transcreve e grava transcript no Postgres.
"""
from __future__ import annotations

import json
import logging
import signal
import sys
from pathlib import Path

import redis

from app.core.config import settings
from app.services import db_client
from app.services.transcribe_pipeline import transcribe_video_file_with_audit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("transcribe_consumer")

_stop = False


def _handle_sig(_signum, _frame):
    global _stop
    _stop = True
    logger.info("Encerrando após job atual…")


def _resolve_path(relative_path: str) -> Path:
    root = Path(settings.media_root).resolve()
    candidate = (root / relative_path).resolve()
    candidate.relative_to(root)
    return candidate


def run_loop() -> None:
    signal.signal(signal.SIGINT, _handle_sig)
    signal.signal(signal.SIGTERM, _handle_sig)

    r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    q = settings.transcribe_queue_key
    logger.info("Consumidor de transcrição em %s (fila=%s) mode=%s", settings.redis_url, q, settings.transcribe_mode)

    while not _stop:
        try:
            item = r.brpop(q, timeout=5)
        except redis.ConnectionError as exc:
            logger.error("Redis: %s", exc)
            continue
        if item is None:
            continue
        if _stop:
            break
        _key, raw = item
        try:
            job = json.loads(raw)
        except json.JSONDecodeError:
            logger.error("Payload inválido: %s", raw[:200])
            continue

        video_id = job.get("video_id")
        relative_path = job.get("relative_path")
        if not video_id or not relative_path:
            logger.error("Job sem video_id/relative_path: %s", job)
            continue

        path = _resolve_path(relative_path)
        if not path.is_file():
            logger.error("Arquivo não encontrado: %s", path)
            try:
                db_client.set_transcript_job_status(video_id, "failed")
            except Exception:
                logger.exception("Não foi possível marcar job como failed")
            continue

        try:
            db_client.set_transcript_job_status(video_id, "processing")
            text, mode, log_entries, scene_desc = transcribe_video_file_with_audit(path)
            db_client.update_video_transcript_full(
                video_id, text, mode, log_entries, scene_description=scene_desc
            )
            logger.info(
                "Transcript salvo para vídeo %s mode=%s (%d chars)",
                video_id,
                mode,
                len(text),
            )

            # --- Geração automática do pool inicial de perguntas ---
            try:
                from app.services.question_service import generate_and_save_questions
                logger.info("Iniciando geração automática do pool inicial para vídeo %s", video_id)
                generate_and_save_questions(video_id, count=5)
                logger.info("Pool inicial gerado com sucesso para vídeo %s", video_id)
            except Exception:
                logger.exception("Falha na geração automática do pool inicial para %s", video_id)
        except Exception:
            logger.exception("Falha ao processar job %s", video_id)
            try:
                db_client.set_transcript_job_status(video_id, "failed")
            except Exception:
                logger.exception("Não foi possível marcar job como failed")


if __name__ == "__main__":
    run_loop()
    sys.exit(0)
