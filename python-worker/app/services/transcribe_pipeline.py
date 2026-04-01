"""
Extração de áudio (ffmpeg) + transcrição (local faster-whisper, Gemini, OpenAI).
Qualquer falha → texto stub genérico + log fallback_stub (auditoria).
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# POC: usado em modo stub explícito ou após falha de transcrição.
STUB_SAMPLE_TRANSCRIPT = (
    "Apresentamos uma solução pensada para o dia a dia. "
    "Simples, prática e feita para poupar tempo. "
    "Descubra como este produto pode mudar a forma como trabalha e vive. "
    "Experimente hoje — a inovação está ao seu alcance."
)
STUB_SAMPLE_SCENE_DESCRIPTION = (
    "00:00 - 00:02: Plano geral de um estúdio luminoso; voz em off apresenta um produto ou serviço. "
    ">> 00:02 - 00:05: Close-up de embalagem ou interface minimalista; texto de apoio na tela. "
    ">> 00:05 - 00:08: Pessoas a utilizar o produto em contextos quotidianos (casa, trabalho, deslocação). "
    ">> 00:08 - 00:10: Logótipo e chamada à ação final; tom otimista. "
    "(Descrição genérica de exemplo — vídeo de propaganda de produto ou serviço inovador e útil.)"
)

_FALLBACK_MSG_MAX = 500


def _extract_wav_16k_mono(video_path: Path) -> Path:
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    wav = Path(wav_path)
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(video_path),
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                str(wav),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        wav.unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg falhou: {exc.stderr}") from exc
    return wav


def _safe_extract_wav(video_path: Path) -> tuple[Path | None, str | None]:
    try:
        return _extract_wav_16k_mono(video_path), None
    except Exception as e:
        return None, str(e)


def transcribe_wav_local(wav_path: Path) -> str:
    from faster_whisper import WhisperModel

    logger.info(
        "faster-whisper model=%s device=%s compute=%s",
        settings.whisper_model,
        settings.whisper_device,
        settings.whisper_compute_type,
    )
    model = WhisperModel(
        settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
    )
    segments, info = model.transcribe(str(wav_path), beam_size=5)
    text = "".join(s.text for s in segments).strip()
    logger.info(
        "transcrição local concluída: %d chars (language=%s)",
        len(text),
        getattr(info, "language", "?"),
    )
    return text


def transcribe_wav_openai(wav_path: Path) -> str:
    if not settings.openai_api_key.strip():
        raise RuntimeError("TRANSCRIBE_MODE=api exige OPENAI_API_KEY")

    from openai import OpenAI

    logger.info("transcrição via OpenAI whisper-1")
    client = OpenAI(api_key=settings.openai_api_key)
    with wav_path.open("rb") as audio_file:
        tr = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
    return (tr.text or "").strip()


def _gemini_transcribe_model_name() -> str:
    if settings.transcribe_gemini_model.strip():
        return settings.transcribe_gemini_model.strip()
    if settings.ai_model.strip():
        return settings.ai_model.strip()
    return "gemini-2.5-flash"


def _wait_gemini_file_active(client, uploaded, timeout_sec: int = 120) -> None:
    """Ficheiros de áudio podem ficar em PROCESSING até ficarem ACTIVE."""
    deadline = time.time() + timeout_sec
    fname = uploaded.name
    while time.time() < deadline:
        f = client.files.get(name=fname)
        state = getattr(f, "state", None)
        sn = getattr(state, "name", None) if state is not None else None
        if sn in (None, "ACTIVE"):
            return
        if sn == "FAILED":
            raise RuntimeError("Processamento do áudio no Gemini falhou (FAILED).")
        time.sleep(2)
    raise TimeoutError("Timeout a aguardar o áudio no Gemini.")


def transcribe_wav_gemini(wav_path: Path) -> str:
    if not settings.gemini_api_key.strip():
        raise RuntimeError("TRANSCRIBE_MODE=gemini exige GEMINI_API_KEY")

    from google import genai

    model = _gemini_transcribe_model_name()
    logger.info("transcrição via Gemini model=%s", model)
    client = genai.Client(api_key=settings.gemini_api_key)
    uploaded = client.files.upload(file=str(wav_path))
    _wait_gemini_file_active(client, uploaded)
    prompt = (
        "Transcreva integralmente o áudio em português. "
        "Responda apenas com o texto transcrito, sem markdown nem comentários."
    )
    response = client.models.generate_content(
        model=model,
        contents=[prompt, uploaded],
    )
    text = (response.text or "").strip()
    try:
        fname = getattr(uploaded, "name", None)
        if fname:
            client.files.delete(name=fname)
    except Exception:
        logger.debug("Não foi possível apagar ficheiro temporário no Gemini", exc_info=True)
    return text


def _append_fallback_stub(entries: list[dict], attempted_mode: str, exc: BaseException) -> None:
    entries.append(
        {
            "event": "fallback_stub",
            "attemptedMode": attempted_mode,
            "errorType": type(exc).__name__,
            "message": str(exc)[:_FALLBACK_MSG_MAX],
        }
    )


def _finish_stub_fallback(entries: list[dict], t0: float) -> tuple[str, str, list[dict], str | None]:
    entries.append(
        {
            "event": "done",
            "durationMs": int((time.perf_counter() - t0) * 1000),
            "chars": len(STUB_SAMPLE_TRANSCRIPT),
            "stubSample": True,
            "fallback": True,
        }
    )
    logger.warning(
        "Transcrição em stub de fallback após falha (ver evento fallback_stub no log)"
    )
    return STUB_SAMPLE_TRANSCRIPT, "stub", entries, STUB_SAMPLE_SCENE_DESCRIPTION


def transcribe_video_file_with_audit(
    video_path: Path,
) -> tuple[str, str, list[dict], str | None]:
    """
    Retorna (texto, modo gravado na BD, log, scene_description ou None).
    Modo stub explícito: texto de exemplo. local/gemini/api: em erro → stub + modo 'stub' + log.
    """
    mode = settings.transcribe_mode.lower().strip()
    entries: list[dict] = []
    t0 = time.perf_counter()
    entries.append(
        {
            "at": datetime.now(timezone.utc).isoformat(),
            "event": "start",
            "mode": mode,
            "file": video_path.name,
        }
    )

    if mode == "stub":
        text = STUB_SAMPLE_TRANSCRIPT
        entries.append(
            {
                "event": "done",
                "durationMs": int((time.perf_counter() - t0) * 1000),
                "chars": len(text),
                "stubSample": True,
            }
        )
        logger.info("transcrição stub (conteúdo de exemplo) para %s", video_path.name)
        return text, mode, entries, STUB_SAMPLE_SCENE_DESCRIPTION

    if mode not in ("local", "gemini", "api"):
        err = ValueError(f"TRANSCRIBE_MODE inválido: {settings.transcribe_mode}")
        _append_fallback_stub(entries, mode, err)
        return _finish_stub_fallback(entries, t0)

    wav, ffmpeg_err = _safe_extract_wav(video_path)
    if wav is None:
        faux = RuntimeError(ffmpeg_err or "ffmpeg falhou")
        _append_fallback_stub(entries, mode, faux)
        return _finish_stub_fallback(entries, t0)

    try:
        t_after_ffmpeg = time.perf_counter()
        entries.append(
            {
                "event": "ffmpeg",
                "durationMs": int((t_after_ffmpeg - t0) * 1000),
            }
        )
        t_tr = time.perf_counter()
        if mode == "local":
            text = transcribe_wav_local(wav)
            entries.append(
                {
                    "event": "transcribe_local",
                    "durationMs": int((time.perf_counter() - t_tr) * 1000),
                    "chars": len(text),
                }
            )
        elif mode == "gemini":
            text = transcribe_wav_gemini(wav)
            entries.append(
                {
                    "event": "transcribe_gemini",
                    "durationMs": int((time.perf_counter() - t_tr) * 1000),
                    "chars": len(text),
                }
            )
        else:
            text = transcribe_wav_openai(wav)
            entries.append(
                {
                    "event": "transcribe_openai",
                    "durationMs": int((time.perf_counter() - t_tr) * 1000),
                    "chars": len(text),
                }
            )

        if not text.strip():
            raise RuntimeError("Transcrição vazia")

        entries.append(
            {
                "event": "done",
                "totalDurationMs": int((time.perf_counter() - t0) * 1000),
            }
        )
        return text.strip(), mode, entries, None
    except Exception as e:
        logger.exception("Falha na transcrição (mode=%s), a usar stub", mode)
        _append_fallback_stub(entries, mode, e)
        return _finish_stub_fallback(entries, t0)
    finally:
        wav.unlink(missing_ok=True)


def transcribe_video_file(video_path: Path) -> str:
    """Transcreve o vídeo completo conforme TRANSCRIBE_MODE (sem auditoria extra)."""
    text, _, _, _ = transcribe_video_file_with_audit(video_path)
    return text
